import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthContext } from "../auth/auth-context.js";
import type { CustomerCreateInput, CustomerUpdateInput } from "@gharsync/validation";

const normalizePhone = (phone: string) => {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.startsWith("92")) digits = digits.slice(2);
  return `+92${digits}`;
};

function escapeCsv(value: string | null | undefined) {
  let safe = value ?? "";
  if (/^\s*[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replaceAll('"', '""')}"`;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private where(auth: AuthContext, includeArchived: boolean, q?: string): Prisma.CustomerWhereInput {
    const organizationId = auth.organizationId!;
    const query = q?.trim();
    return {
      organizationId,
      deletedAt: null,
      ...(auth.branchId ? { branchId: auth.branchId } : {}),
      ...(includeArchived ? {} : { isActive: true }),
      ...(query ? { OR: [
        { fullName: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
        { email: { contains: query, mode: "insensitive" } },
      ] } : {}),
    };
  }

  async list(auth: AuthContext, options: { q?: string; status: "active" | "archived" | "all"; page: number; pageSize: number }) {
    const where = this.where(auth, options.status === "all", options.q);
    if (options.status === "archived") where.isActive = false;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: {
          id: true, fullName: true, phone: true, email: true, tags: true, isActive: true, createdAt: true,
          addresses: { where: { isDefault: true }, take: 1, select: { address: true, city: true } },
          _count: { select: { bookings: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data: items, pagination: { page: options.page, pageSize: options.pageSize, total, totalPages: Math.ceil(total / options.pageSize) } };
  }

  async create(auth: AuthContext, input: CustomerCreateInput) {
    const organizationId = auth.organizationId!;
    const phone = normalizePhone(input.phone);
    const duplicate = await this.prisma.customer.findFirst({ where: { organizationId, phone, deletedAt: null }, select: { id: true, fullName: true } });
    if (duplicate) throw new ConflictException({ message: "A customer with this phone number already exists.", existingCustomerId: duplicate.id, existingCustomerName: duplicate.fullName });
    if (Boolean(input.address) !== Boolean(input.city)) throw new BadRequestException("Provide both address and city, or leave both empty.");
    let branchId = auth.branchId;
    if (!branchId) {
      const defaultBranch = await this.prisma.branch.findFirst({ where: { organizationId, isDefault: true, deletedAt: null }, select: { id: true } });
      branchId = defaultBranch?.id ?? null;
    }
    try {
      const customer = await this.prisma.customer.create({
        data: {
          organizationId, branchId, fullName: input.fullName.trim(), phone,
          email: input.email?.trim() || null, notes: input.notes?.trim() || null, tags: input.tags,
          ...(input.address && input.city ? { addresses: { create: { address: input.address, city: input.city, isDefault: true } } } : {}),
        },
        select: { id: true, fullName: true, phone: true, email: true, notes: true, tags: true, isActive: true, createdAt: true },
      });
      await this.prisma.auditLog.create({ data: { organizationId, actorUserId: auth.userId, action: "customer.created", resourceType: "customer", resourceId: customer.id } });
      return customer;
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") throw new ConflictException("A customer with these details already exists.");
      throw error;
    }
  }

  async get(auth: AuthContext, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: auth.organizationId!, deletedAt: null, ...(auth.branchId ? { branchId: auth.branchId } : {}) },
      include: {
        addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] },
        bookings: {
          where: { organizationId: auth.organizationId!, deletedAt: null },
          orderBy: { createdAt: "desc" }, take: 20,
          select: { id: true, status: true, description: true, createdAt: true, scheduledAt: true, service: { select: { name: true } }, branch: { select: { name: true } } },
        },
      },
    });
    if (!customer) throw new NotFoundException("Customer not found.");
    return customer;
  }

  async update(auth: AuthContext, customerId: string, input: CustomerUpdateInput) {
    const organizationId = auth.organizationId!;
    const current = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null, ...(auth.branchId ? { branchId: auth.branchId } : {}) },
      select: { id: true, phone: true, addresses: { where: { isDefault: true }, take: 1, select: { id: true } } },
    });
    if (!current) throw new NotFoundException("Customer not found.");
    const phone = input.phone ? normalizePhone(input.phone) : undefined;
    if (phone && phone !== current.phone) {
      const duplicate = await this.prisma.customer.findFirst({ where: { organizationId, phone, id: { not: customerId }, deletedAt: null }, select: { id: true } });
      if (duplicate) throw new ConflictException("A customer with this phone number already exists.");
    }
    if (input.address !== undefined && input.city === undefined && !current.addresses[0]) throw new BadRequestException("Provide a city with the address.");
    if (input.city !== undefined && input.address === undefined && !current.addresses[0]) throw new BadRequestException("Provide an address with the city.");
    const data: Prisma.CustomerUpdateInput = {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(phone ? { phone } : {}),
      ...(input.email !== undefined ? { email: input.email.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({ where: { id: customerId }, data });
      if (input.address !== undefined || input.city !== undefined) {
        const addressId = current.addresses[0]?.id;
        const previous = addressId ? await tx.customerAddress.findUnique({ where: { id: addressId }, select: { address: true, city: true } }) : null;
        const address = input.address ?? previous?.address;
        const city = input.city ?? previous?.city;
        if (address && city) {
          if (addressId) await tx.customerAddress.update({ where: { id: addressId }, data: { address, city } });
          else await tx.customerAddress.create({ data: { customerId, address, city, isDefault: true } });
        }
      }
      await tx.auditLog.create({ data: { organizationId, actorUserId: auth.userId, action: "customer.updated", resourceType: "customer", resourceId: customerId } });
    });
    return this.get(auth, customerId);
  }

  async archive(auth: AuthContext, customerId: string) {
    const organizationId = auth.organizationId!;
    const result = await this.prisma.customer.updateMany({
      where: { id: customerId, organizationId, deletedAt: null, ...(auth.branchId ? { branchId: auth.branchId } : {}) },
      data: { isActive: false, deletedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException("Customer not found.");
    await this.prisma.auditLog.create({ data: { organizationId, actorUserId: auth.userId, action: "customer.archived", resourceType: "customer", resourceId: customerId } });
    return { status: "archived" };
  }

  async exportCsv(auth: AuthContext) {
    const rows = await this.prisma.customer.findMany({
      where: { ...this.where(auth, false), isActive: true }, take: 5_000,
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      select: { fullName: true, phone: true, email: true, tags: true, createdAt: true },
    });
    const lines = ["Name,Phone,Email,Tags,Created at", ...rows.map((row) => [
      escapeCsv(row.fullName), escapeCsv(row.phone), escapeCsv(row.email), escapeCsv(row.tags.join("; ")), escapeCsv(row.createdAt.toISOString()),
    ].join(","))];
    return { csv: `\uFEFF${lines.join("\r\n")}`, exported: rows.length, truncated: rows.length === 5_000 };
  }
}

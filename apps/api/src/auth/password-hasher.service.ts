import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const COST = 2 ** 17;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, cost = COST): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: cost, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

@Injectable()
export class PasswordHasherService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt);
    return ["scrypt", COST, 8, 1, salt.toString("hex"), key.toString("hex")].join("$");
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    const [algorithm, costText, rText, pText, saltText, keyText] = encoded.split("$");
    if (algorithm !== "scrypt" || !costText || !rText || !pText || !saltText || !keyText) return false;
    const cost = Number(costText);
    if (!Number.isSafeInteger(cost) || cost < 2 ** 14 || cost > 2 ** 18 || rText !== "8" || pText !== "1") return false;
    const salt = Buffer.from(saltText, "hex");
    const expected = Buffer.from(keyText, "hex");
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await derive(password, salt, cost);
    return timingSafeEqual(actual, expected);
  }
}

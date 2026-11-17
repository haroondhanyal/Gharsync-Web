import {
  Body, Controller, Delete, Get, Header, HttpCode, Param, Patch, Post, Req, Res, UploadedFile, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  passwordResetCompleteSchema, passwordResetRequestSchema, phoneOtpSchema,
  signInSchema, signUpSchema, profileUpdateSchema, passwordChangeSchema,
} from "@gharsync/validation";
import { AllowUnverified, CurrentAuth, Public, type AuthContext } from "./auth-context.js";
import { AuthService } from "./auth.service.js";

const ACCESS_COOKIE = "__Host-gs-access";
const REFRESH_COOKIE = "__Host-gs-refresh";
const ACCESS_MS = 15 * 60 * 1000;
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

function cookies(response: Response, tokens: { accessToken: string; refreshToken: string }) {
  response.cookie(ACCESS_COOKIE, tokens.accessToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: ACCESS_MS });
  response.cookie(REFRESH_COOKIE, tokens.refreshToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: REFRESH_MS });
}

function accessCookie(response: Response, token: string) {
  response.cookie(ACCESS_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: ACCESS_MS });
}

function clearCookies(response: Response) {
  const options = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  response.clearCookie(ACCESS_COOKIE, options);
  response.clearCookie(REFRESH_COOKIE, options);
}

function refreshCookie(request: Request) {
  const value = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE}=`));
  if (!value) return undefined;
  try { return decodeURIComponent(value.slice(REFRESH_COOKIE.length + 1)); } catch { return undefined; }
}

function requestInfo(request: Request) {
  const userAgent = request.headers["user-agent"];
  return { ip: request.ip, userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post("register")
  async register(
    @Body({ schema: signUpSchema }) body: z.infer<typeof signUpSchema>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(body, requestInfo(request));
    cookies(response, result.tokens);
    return { user: result.user, phoneVerificationRequired: result.phoneVerificationRequired };
  }

  @Public()
  @Throttle({ auth: { limit: 8, ttl: 60_000 } })
  @Post("sign-in")
  @HttpCode(200)
  async signIn(
    @Body({ schema: signInSchema }) body: z.infer<typeof signInSchema>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.signIn(body.email, body.password, requestInfo(request));
    cookies(response, result.tokens);
    return { user: result.user, phoneVerificationRequired: result.phoneVerificationRequired };
  }

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = refreshCookie(request);
    if (!token) return this.auth.refresh("");
    const rotated = await this.auth.refresh(token);
    cookies(response, rotated);
    return { status: "refreshed" };
  }

  @Public()
  @Post("sign-out")
  @HttpCode(200)
  async signOut(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.signOut(refreshCookie(request), requestInfo(request));
    clearCookies(response);
    return result;
  }

  @Get("me")
  me(@CurrentAuth() current: AuthContext) {
    return this.auth.getMe(current.userId, current.organizationId);
  }

  @Patch("me/profile")
  updateProfile(@CurrentAuth() current: AuthContext, @Body({ schema: profileUpdateSchema }) body: z.infer<typeof profileUpdateSchema>) {
    return this.auth.updateProfile(current.userId, body);
  }

  @Patch("me/password")
  changePassword(@CurrentAuth() current: AuthContext, @Body({ schema: passwordChangeSchema }) body: z.infer<typeof passwordChangeSchema>) {
    return this.auth.changePassword(current, body.currentPassword, body.newPassword);
  }

  @Post("me/avatar")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  uploadAvatar(@CurrentAuth() current: AuthContext, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.auth.uploadAvatar(current.userId, file);
  }

  @Delete("me/avatar")
  removeAvatar(@CurrentAuth() current: AuthContext) { return this.auth.removeAvatar(current.userId); }

  @Get("me/avatar")
  @Header("Cache-Control", "private, no-store")
  async avatar(@CurrentAuth() current: AuthContext, @Res() response: Response) {
    const image = await this.auth.getAvatar(current.userId);
    response.setHeader("Content-Type", image.mimeType);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    return response.end(image.buffer);
  }

  @Post("organizations/:organizationId/select")
  @HttpCode(200)
  async selectOrganization(
    @CurrentAuth() current: AuthContext,
    @Param("organizationId", { schema: z.uuid() }) organizationId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const selected = await this.auth.selectOrganization(current, organizationId);
    accessCookie(response, selected.accessToken);
    return { organization: selected.organization };
  }

  @Get("sessions")
  sessions(@CurrentAuth() current: AuthContext) {
    return this.auth.listSessions(current);
  }

  @Delete("sessions/:sessionId")
  @HttpCode(200)
  async revokeSession(
    @CurrentAuth() current: AuthContext,
    @Param("sessionId", { schema: z.uuid() }) sessionId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.revokeSession(current, sessionId);
    if (sessionId === current.sessionId) clearCookies(response);
    return result;
  }

  @Post("sign-out-everywhere")
  @HttpCode(200)
  async signOutEverywhere(@CurrentAuth() current: AuthContext, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.signOutEverywhere(current);
    clearCookies(response);
    return result;
  }

  @AllowUnverified()
  @Throttle({ auth: { limit: 3, ttl: 60 * 60 * 1000 } })
  @Post("phone-otp/request")
  requestPhoneOtp(@CurrentAuth() current: AuthContext) {
    return this.auth.requestPhoneOtp(current.userId);
  }

  @AllowUnverified()
  @Throttle({ auth: { limit: 8, ttl: 60_000 } })
  @Post("phone-otp/verify")
  @HttpCode(200)
  verifyPhoneOtp(@CurrentAuth() current: AuthContext, @Body({ schema: phoneOtpSchema }) body: z.infer<typeof phoneOtpSchema>) {
    return this.auth.verifyPhoneOtp(current.userId, body.code);
  }

  @Public()
  @Throttle({ auth: { limit: 3, ttl: 60_000 } })
  @Post("password-reset/request")
  @HttpCode(202)
  requestPasswordReset(@Body({ schema: passwordResetRequestSchema }) body: z.infer<typeof passwordResetRequestSchema>) {
    return this.auth.requestPasswordReset(body.email);
  }

  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post("password-reset/complete")
  @HttpCode(200)
  completePasswordReset(@Body({ schema: passwordResetCompleteSchema }) body: z.infer<typeof passwordResetCompleteSchema>) {
    return this.auth.completePasswordReset(body.token, body.password);
  }
}

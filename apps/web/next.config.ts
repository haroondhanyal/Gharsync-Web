import dotenv from "dotenv";
import type { NextConfig } from "next";

dotenv.config({ path: "../../.env" });

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1",
  },
};

export default nextConfig;

import type { ConnectionProfile } from "../core/types";
import { isProduction } from "../utils/productionGuard";

/** Cấu hình policy an toàn (đọc từ settings). */
export interface SecurityPolicy {
  disableWriteOnProduction: boolean;
  disableExportOnProduction: boolean;
  maxRows: number;
}

/** Hàm đọc policy hiện tại (bọc vscode config để test được). */
export type PolicyReader = () => SecurityPolicy;

/**
 * Thực thi policy an toàn. Khác với production guard (chỉ confirm), policy là
 * chặn cứng khi bật: ghi/export trên production bị từ chối hẳn.
 */
export class PolicyService {
  constructor(private readonly read: PolicyReader) {}

  policy(): SecurityPolicy {
    return this.read();
  }

  maxRows(): number {
    return this.read().maxRows;
  }

  isWriteBlocked(profile: ConnectionProfile): boolean {
    return isProduction(profile) && this.read().disableWriteOnProduction;
  }

  isExportBlocked(profile: ConnectionProfile): boolean {
    return isProduction(profile) && this.read().disableExportOnProduction;
  }

  /** Ném lỗi rõ ràng nếu thao tác ghi bị policy chặn. */
  assertWriteAllowed(profile: ConnectionProfile): void {
    if (this.isWriteBlocked(profile)) {
      throw new Error(
        `Blocked: writes on production connection "${profile.name}" are disabled by policy (openDbNexus.security.disableWriteOnProduction).`
      );
    }
  }

  assertExportAllowed(profile: ConnectionProfile): void {
    if (this.isExportBlocked(profile)) {
      throw new Error(
        `Blocked: exports on production connection "${profile.name}" are disabled by policy (openDbNexus.security.disableExportOnProduction).`
      );
    }
  }
}

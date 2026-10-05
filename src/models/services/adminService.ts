import { adminRepository } from "@/data/repositories/adminRepository";
import { AdminUser } from "@/models/types/admin.types";

export class AdminService {
  async getUsers(): Promise<AdminUser[]> {
    return adminRepository.fetchUsers();
  }

  async updateLitellmBudget(userId: string, maxBudget: number): Promise<void> {
    await adminRepository.updateUser({
      user_id: userId,
      litellm_max_budget: maxBudget,
    });
  }

  async isAdmin(): Promise<boolean> {
    return adminRepository.checkIsAdmin();
  }

  async repairLiteLLMUsers() {
    return adminRepository.repairLiteLLMUsers();
  }
}

export const adminService = new AdminService();

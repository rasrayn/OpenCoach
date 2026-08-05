import { User } from '../entities/User'

/**
 * IUserRepository — pure domain interface.
 * Implementations live in the infrastructure layer.
 */
export interface IUserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  save(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>
  update(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User>
  delete(id: string): Promise<void>
}

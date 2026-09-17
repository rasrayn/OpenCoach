import bcrypt from 'bcryptjs'
import { BcryptPasswordHasher } from '../BcryptPasswordHasher'

describe('BcryptPasswordHasher', () => {
  it('stores passwords as bcrypt hashes with cost factor 12', async () => {
    const password = 'Secure1!'
    const hash = await new BcryptPasswordHasher().hash(password)
    const cost = Number(hash.slice(4, 6))

    expect(hash).toMatch(/^\$2[ab]?\$12\$/)
    expect(cost).toBeGreaterThanOrEqual(12)
    expect(hash).not.toContain(password)
    await expect(bcrypt.compare(password, hash)).resolves.toBe(true)
  })

  it('does not accept an incorrect password', async () => {
    const hasher = new BcryptPasswordHasher()
    const hash = await hasher.hash('Secure1!')
    await expect(hasher.compare('Wrong1!', hash)).resolves.toBe(false)
  })
})

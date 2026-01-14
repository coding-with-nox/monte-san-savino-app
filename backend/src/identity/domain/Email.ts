export class Email {
  private constructor(public readonly value: string) {}
  static create(input: string): Email {
    const v = input.trim().toLowerCase();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    if (!ok) throw new Error("Invalid email");
    return new Email(v);
  }
}

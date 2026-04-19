class PasswordResetToken {
  constructor(init?: Partial<PasswordResetToken>) {
    Object.assign(this, init);
  }

  id!: number;
  userId!: number;
  email!: string;
  createdAt!: Date;
  updatedAt!: Date;
  expires!: Date;
  token!: string;
  active!: boolean;
}

export default PasswordResetToken;

class InviteUser {
  constructor(init?: Partial<InviteUser>) {
    Object.assign(this, init);
  }

  id!: number;
  emailInvited!: string;
  createdAt!: Date;
  updatedAt!: Date;
  expires!: Date;
  token!: string;
  active!: boolean;
}

export default InviteUser;

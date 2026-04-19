import { Injectable } from '@nestjs/common';
import { User } from '../entities/user.entity';

type CreateUserInput = Omit<User, 'id'>;

@Injectable()
export class UsersService {
  private users: User[] = [
    {
      id: 0,
      name: 'Aureo',
      email: 'aureo@gmail.com',
      password: 'aureopass',
    },
    {
      id: 1,
      name: 'Bueno',
      email: 'bueno@gmail.com',
      password: 'buenopass',
    },
  ];

  findByEmail(email: string): Promise<User | undefined> {
    const user = this.users.find((item: User) => item.email === email);
    return Promise.resolve(user);
  }

  findOne(id: number): Promise<User | undefined> {
    const user = this.users.find((item: User) => item.id === id);
    return Promise.resolve(user);
  }

  create(input: CreateUserInput): Promise<User> {
    const user: User = {
      id:
        this.users.length === 0 ? 0 : this.users[this.users.length - 1].id + 1,
      ...input,
    };

    this.users.push(user);
    return Promise.resolve(user);
  }

  updatePassword(id: number, password: string): Promise<User | undefined> {
    const user = this.users.find((item: User) => item.id === id);
    if (!user) {
      return Promise.resolve(undefined);
    }

    user.password = password;
    return Promise.resolve(user);
  }
}

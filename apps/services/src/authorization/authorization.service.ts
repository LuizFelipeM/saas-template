import { Inject, Injectable, Logger } from '@nestjs/common';
import { IResource, IUser, Permit } from 'permitio';
import { PERMIT_CLIENT } from '../clients';

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(@Inject(PERMIT_CLIENT) private readonly permitClient: Permit) {}

  async check(
    user: string | IUser,
    action: string,
    resource: string | IResource,
  ): Promise<boolean> {
    return await this.permitClient.check(user, action, resource);
  }
}

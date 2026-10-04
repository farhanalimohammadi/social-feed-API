import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { isUUID } from 'class-validator';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppConfig } from '../../../config/index.js';
import type { AuthenticatedUser } from '../../../common/interfaces/authenticated-user.interface.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import { publicUserSelect } from '../auth.select.js';
//اعتبارا سنجی توکن 


@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt', { infer: true }).secret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: { sub?: unknown }): Promise<AuthenticatedUser> {
    if (typeof payload.sub !== 'string' || !isUUID(payload.sub, '4')) {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: publicUserSelect,
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
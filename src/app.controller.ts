import { Controller, Get, SetMetadata } from '@nestjs/common';
import { AppService } from './app.service';
import { requireLogin, requirePermission } from './custom.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('aaa')
  @requireLogin()
  @requirePermission('ddd', 'ccc')
  aaa() {
    return 'aaa';
  }

  @Get('bbb')
  bbb() {
    return 'bbb';
  }
}

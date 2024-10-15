import { Module } from '@nestjs/common';
import { UseController } from './use.controller';

@Module({
  controllers: [UseController],
})
export class UseModule {}

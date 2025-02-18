import {
  Body,
  Controller,
  Inject,
  OnModuleInit,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import {
  CreateResourceRequest,
  RESOURCES_SERVICE_NAME,
  ResourcesServiceClient,
} from '@protos/saas-proto-services/resources.service';
import { GRPC_SERVICES, JwtAuthGuard } from '../../../../libs/common/src';

@Controller('resources')
@UseGuards(JwtAuthGuard)
export class ResourcesController implements OnModuleInit {
  private resourcesServiceClient: ResourcesServiceClient;

  constructor(
    @Inject(GRPC_SERVICES)
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.resourcesServiceClient =
      this.client.getService<ResourcesServiceClient>(RESOURCES_SERVICE_NAME);
  }

  @Post()
  create(@Body() payload: CreateResourceRequest) {
    return this.resourcesServiceClient.create(payload);
  }
}

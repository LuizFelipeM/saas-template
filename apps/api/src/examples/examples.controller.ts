import { GRPC_MAIN, JwtAuthGuard } from '@common';
import {
  Controller,
  Get,
  Inject,
  Logger,
  OnModuleInit,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import {
  EXAMPLE_SERVICE_NAME,
  ExampleResponse,
  ExampleServiceClient,
} from '@protos/proto-main/example.service';
import { Observable } from 'rxjs';

@Controller('examples')
@UseGuards(JwtAuthGuard)
export class ExamplesController implements OnModuleInit {
  private readonly logger = new Logger(ExamplesController.name);
  private exampleServiceClient: ExampleServiceClient;

  constructor(
    @Inject(GRPC_MAIN)
    private readonly client: ClientGrpc,
  ) {}

  onModuleInit() {
    this.exampleServiceClient =
      this.client.getService<ExampleServiceClient>(EXAMPLE_SERVICE_NAME);
  }

  @Get()
  greeting(@Query('name') name: string): Observable<ExampleResponse> {
    return this.exampleServiceClient.greeting({ name });
  }
}

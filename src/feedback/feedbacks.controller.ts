import { CurrentUserId } from '@common/decorators';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/authentication/guards/jwt-auth.guard';
import { AnswerSurveyDto } from './dtos/answer-survey.dto';
import { FeedbacksService } from './feedbacks.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class FeedbacksController {
  constructor(private readonly feedbackService: FeedbacksService) {}

  @Post('answer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async answer(
    @CurrentUserId() userId: string,
    @Body() answerSurvey: AnswerSurveyDto,
  ): Promise<void> {
    await this.feedbackService.answer(userId, answerSurvey);
  }
}
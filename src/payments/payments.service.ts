import { STRIPE_CLIENT } from '@clients';
import { Inject, Injectable, Logger, RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthenticationService } from 'src/authentication/authentication.service';
import Stripe from 'stripe';
import { CustomerSubscriptionEventHandler } from './event-handlers/customer-subscription/customer-subscription.event-handler';
import { EventHandler } from './event-handlers/event-handler';
import { PlanRepository } from './repositories/plan.repository';

type LineItem = Stripe.Checkout.SessionCreateParams.LineItem;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly eventHandlers: EventHandler[] = [];

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripeClient: Stripe,
    private readonly configService: ConfigService,
    private readonly authenticationService: AuthenticationService,
    private readonly customerSubscriptionEventHandler: CustomerSubscriptionEventHandler,
    private readonly planRepository: PlanRepository,
  ) {
    this.eventHandlers = [this.customerSubscriptionEventHandler];
  }

  async listPrice(
    lookupKey: string[],
  ): Promise<Stripe.Response<Stripe.ApiList<Stripe.Price>>> {
    const prices = await this.stripeClient.prices.list({
      lookup_keys: lookupKey,
      expand: ['data.product'],
    });
    return prices;
  }

  async createCheckoutSession(
    userId: string,
    selectedPlans: string[],
  ): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    const prices = await this.stripeClient.prices.list({
      lookup_keys: selectedPlans,
      expand: [],
    });

    const plans = await this.planRepository.find(
      selectedPlans.map((plan) => ({ id: plan })),
    );

    const user = await this.authenticationService.getUserById(userId);
    const domain = this.configService.get<string>('DOMAIN');
    const userEmail = user.emailAddresses[0].emailAddress;
    const session = await this.stripeClient.checkout.sessions.create({
      line_items: prices.data.map<LineItem>(({ id, lookup_key }) => {
        let adjustable_quantity: LineItem['adjustable_quantity'] = undefined;

        const plan = plans.find((p) => p.id === lookup_key);
        if (!!plan.max)
          adjustable_quantity = {
            enabled: true,
            minimum: plan.min,
            maximum: plan.max,
          };

        return {
          price: id,
          quantity: plan.min,
          adjustable_quantity,
        };
      }),
      mode: 'subscription',
      subscription_data: {
        metadata: {
          userId,
          userEmail,
        },
      },
      client_reference_id: userId,
      customer_email: userEmail,
      success_url: `${domain}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domain}/canceled`,
    });

    return session;
  }

  async createCustomerPortalSession(
    sessionId: string,
  ): Promise<Stripe.Response<Stripe.BillingPortal.Session>> {
    const checkoutSession =
      await this.stripeClient.checkout.sessions.retrieve(sessionId);

    let customer: string;
    if (typeof checkoutSession.customer === 'string')
      customer = checkoutSession.customer;
    else {
      if (checkoutSession.customer.deleted)
        throw new Error('Unable to create a portal session for a deleted user');
      customer = checkoutSession.customer.id;
    }

    const session = await this.stripeClient.billingPortal.sessions.create({
      customer,
      return_url: this.configService.get<string>('DOMAIN'),
    });

    return session;
  }

  async processEvent(request: RawBodyRequest<Request>): Promise<void> {
    let event = request.body as Stripe.Event;

    const endpointSecret = this.configService.get<string>(
      'STRIPE_ENDPOINT_SECRET',
    );

    if (!endpointSecret) {
      try {
        const signature = request.header('stripe-signature');
        event = this.stripeClient.webhooks.constructEvent(
          request.body,
          signature,
          endpointSecret,
        );
      } catch (err) {
        this.logger.error(
          '⚠️ Webhook signature verification failed.',
          err.message,
        );
        throw new Error('⚠️ Webhook signature verification failed.');
      }
    }

    await Promise.all(
      this.eventHandlers.map((handler) => handler.handle(event)),
    );
  }
}

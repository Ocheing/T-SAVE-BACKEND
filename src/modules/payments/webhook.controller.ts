// src/payment/webhook.controller.ts
import {
  Controller,
  Post,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PaymentService } from './payments.service';
import { ProcessWebhookDto } from './dto/process-webhook.dto';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly paymentService: PaymentService) {}

  // ===== M-PESA WEBHOOKS =====

  @Post('mpesa/payment')
  async handleMpesaPayment(
    @Body() body: any,
    @Headers() headers: any,
  ) {
    try {
      this.logger.log('M-Pesa payment webhook received', { body, headers });

      // Verify webhook signature (implement based on your M-Pesa setup)
      const isValid = this.verifyMpesaWebhook(headers, body);
      if (!isValid) {
        throw new HttpException('Invalid webhook signature', HttpStatus.UNAUTHORIZED);
      }

      // Extract transaction data from M-Pesa response
      const webhookData = this.parseMpesaPaymentWebhook(body);

      const processWebhookDto: ProcessWebhookDto = {
        transactionId: webhookData.transactionId,
        status: webhookData.status,
        reference: webhookData.reference,
        provider: 'mpesa'
      };

      const result = await this.paymentService.processMpesaWebhook(processWebhookDto);

      this.logger.log('M-Pesa webhook processed successfully');
      return result;
    } catch (error) {
      this.logger.error('M-Pesa webhook processing failed', error);
      throw new HttpException(
        'Webhook processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('mpesa/callback')
  async handleMpesaCallback(
    @Body() body: any,
    @Headers() headers: any,
  ) {
    try {
      this.logger.log('M-Pesa callback received', { body, headers });

      // Process M-Pesa STK push callback
      const callbackData = this.parseMpesaCallback(body);

      if (callbackData.ResultCode === 0) {
        // Payment successful
        const processWebhookDto: ProcessWebhookDto = {
          transactionId: callbackData.transactionId,
          status: 'success',
          reference: callbackData.MpesaReceiptNumber,
          provider: 'mpesa'
        };

        await this.paymentService.processMpesaWebhook(processWebhookDto);
      } else {
        // Payment failed
        const processWebhookDto: ProcessWebhookDto = {
          transactionId: callbackData.transactionId,
          status: 'failed',
          reference: callbackData.MpesaReceiptNumber,
          provider: 'mpesa'
        };

        await this.paymentService.processMpesaWebhook(processWebhookDto);
      }

      return {
        ResultCode: 0,
        ResultDesc: 'Success'
      };
    } catch (error) {
      this.logger.error('M-Pesa callback processing failed', error);
      return {
        ResultCode: 1,
        ResultDesc: 'Failed'
      };
    }
  }

  // ===== CARD PAYMENT WEBHOOKS =====

  @Post('card/stripe')
  async handleStripeWebhook(
    @Body() body: any,
    @Headers() headers: any,
  ) {
    try {
      this.logger.log('Stripe webhook received', { body, headers });

      // Verify Stripe webhook signature
      const isValid = await this.verifyStripeWebhook(headers, body);
      if (!isValid) {
        throw new HttpException('Invalid Stripe signature', HttpStatus.UNAUTHORIZED);
      }

      const event = body;
      let processWebhookDto: ProcessWebhookDto;

      switch (event.type) {
        case 'payment_intent.succeeded':
          processWebhookDto = {
            transactionId: event.data.object.metadata.transactionId,
            status: 'success',
            reference: event.data.object.id,
            provider: 'card'
          };
          break;

        case 'payment_intent.payment_failed':
          processWebhookDto = {
            transactionId: event.data.object.metadata.transactionId,
            status: 'failed',
            reference: event.data.object.id,
            provider: 'card'
          };
          break;

        default:
          this.logger.log(`Unhandled Stripe event type: ${event.type}`);
          return { received: true };
      }

      const result = await this.paymentService.processCardWebhook(processWebhookDto);
      this.logger.log('Stripe webhook processed successfully');
      return result;
    } catch (error) {
      this.logger.error('Stripe webhook processing failed', error);
      throw new HttpException(
        'Webhook processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('card/flutterwave')
  async handleFlutterwaveWebhook(
    @Body() body: any,
    @Headers() headers: any,
  ) {
    try {
      this.logger.log('Flutterwave webhook received', { body, headers });

      // Verify Flutterwave webhook signature
      const isValid = this.verifyFlutterwaveWebhook(headers, body);
      if (!isValid) {
        throw new HttpException('Invalid Flutterwave signature', HttpStatus.UNAUTHORIZED);
      }

      const event = body;
      let processWebhookDto: ProcessWebhookDto;

      if (event.event === 'charge.completed' && event.data.status === 'successful') {
        processWebhookDto = {
          transactionId: event.data.tx_ref,
          status: 'success',
          reference: event.data.flw_ref,
          provider: 'card'
        };
      } else if (event.event === 'charge.failed') {
        processWebhookDto = {
          transactionId: event.data.tx_ref,
          status: 'failed',
          reference: event.data.flw_ref,
          provider: 'card'
        };
      } else {
        this.logger.log(`Unhandled Flutterwave event: ${event.event}`);
        return { status: 'ignored' };
      }

      const result = await this.paymentService.processCardWebhook(processWebhookDto);
      this.logger.log('Flutterwave webhook processed successfully');
      return result;
    } catch (error) {
      this.logger.error('Flutterwave webhook processing failed', error);
      throw new HttpException(
        'Webhook processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ===== BANK TRANSFER WEBHOOKS =====

  @Post('bank/transfer')
  async handleBankTransferWebhook(
    @Body() body: any,
    @Headers() headers: any,
  ) {
    try {
      this.logger.log('Bank transfer webhook received', { body, headers });

      // Verify bank webhook signature
      const isValid = this.verifyBankWebhook(headers, body);
      if (!isValid) {
        throw new HttpException('Invalid bank webhook signature', HttpStatus.UNAUTHORIZED);
      }

      const webhookData = body;
      const processWebhookDto: ProcessWebhookDto = {
        transactionId: webhookData.transactionId,
        status: webhookData.status === 'completed' ? 'success' : 'failed',
        reference: webhookData.referenceNumber,
        provider: 'bank'
      };

      // For bank transfers, we'll create a custom processor
      const transaction = await this.processBankWebhook(processWebhookDto);

      this.logger.log('Bank transfer webhook processed successfully');
      return {
        success: true,
        data: transaction,
        message: 'Bank transfer processed successfully'
      };
    } catch (error) {
      this.logger.error('Bank transfer webhook processing failed', error);
      throw new HttpException(
        'Webhook processing failed',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ===== HEALTH CHECK =====

  @Post('health')
  async webhookHealthCheck(@Body() body: any) {
    this.logger.log('Webhook health check received', body);
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'Webhook endpoints are operational'
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  private verifyMpesaWebhook(headers: any, body: any): boolean {
    // Implement M-Pesa webhook signature verification
    // This is a simplified version - implement based on your M-Pesa provider
    const signature = headers['signature'];
    const expectedSignature = this.generateMpesaSignature(body);
    return signature === expectedSignature;
  }

  private async verifyStripeWebhook(headers: any, body: any): Promise<boolean> {
    // Implement Stripe webhook signature verification
    // You'll need to use the Stripe SDK for this
    const stripeSignature = headers['stripe-signature'];
    // Add actual Stripe verification logic here
    return true; // Placeholder
  }

  private verifyFlutterwaveWebhook(headers: any, body: any): boolean {
    // Implement Flutterwave webhook signature verification
    const signature = headers['verifi-hash'];
    const expectedSignature = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    return signature === expectedSignature;
  }

  private verifyBankWebhook(headers: any, body: any): boolean {
    // Implement bank-specific webhook verification
    // This will depend on your bank's API
    const apiKey = headers['x-api-key'];
    const expectedApiKey = process.env.BANK_WEBHOOK_API_KEY;
    return apiKey === expectedApiKey;
  }

  private parseMpesaPaymentWebhook(body: any): any {
    // Parse M-Pesa payment webhook data
    return {
      transactionId: body.TransactionID,
      status: body.ResultCode === 0 ? 'success' : 'failed',
      reference: body.MpesaReceiptNumber,
      amount: body.TransAmount,
      phoneNumber: body.MSISDN
    };
  }

  private parseMpesaCallback(body: any): any {
    // Parse M-Pesa STK push callback data
    const callbackMetadata = body.CallbackMetadata;
    const metadata = {};
    
    if (callbackMetadata && callbackMetadata.Item) {
      callbackMetadata.Item.forEach(item => {
        metadata[item.Name] = item.Value;
      });
    }

    return {
      transactionId: body.MerchantRequestID,
      ResultCode: body.ResultCode,
      ResultDesc: body.ResultDesc,
      MpesaReceiptNumber: metadata['MpesaReceiptNumber'],
      TransactionDate: metadata['TransactionDate'],
      PhoneNumber: metadata['PhoneNumber']
    };
  }

  private async processBankWebhook(processWebhookDto: ProcessWebhookDto): Promise<any> {
    // Custom bank webhook processing logic
    const transaction = await this.paymentService.processMpesaWebhook(processWebhookDto);
    return transaction;
  }

  private generateMpesaSignature(body: any): string {
    // Generate M-Pesa webhook signature
    // Implement based on your M-Pesa provider's requirements
    const payload = JSON.stringify(body);
    return require('crypto')
      .createHmac('sha256', process.env.MPESA_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
  }
}

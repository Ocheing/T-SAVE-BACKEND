// src/payment/payment.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ProcessWebhookDto } from './dto/process-webhook.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async initiatePayment(userId: string, initiatePaymentDto: InitiatePaymentDto) {
    try {
      // Create transaction record
      const transaction = await this.prisma.transaction.create({
        data: {
          userId,
          amount: initiatePaymentDto.amount,
          type: initiatePaymentDto.type,
          provider: initiatePaymentDto.provider,
          category: initiatePaymentDto.category,
          notes: initiatePaymentDto.notes,
          savingId: initiatePaymentDto.savingId,
          bookingId: initiatePaymentDto.bookingId,
          status: 'pending',
        },
      });

      // Process payment based on provider
      const paymentResult = await this.processPayment(transaction, initiatePaymentDto);

      return {
        success: true,
        data: {
          transaction,
          paymentResult
        },
        message: 'Payment initiated successfully'
      };
    } catch (error) {
      this.logger.error('Failed to initiate payment', error);
      throw new Error('Could not initiate payment');
    }
  }

  async getUserPayments(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: { userId },
          include: {
            saving: { include: { trip: true } },
            booking: { include: { trip: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.transaction.count({ where: { userId } })
      ]);

      return {
        success: true,
        data: {
          transactions,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch user payments', error);
      throw new Error('Could not fetch payments');
    }
  }

  async getUserTransactions(userId: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.transaction.count({ where: { userId } })
      ]);

      return {
        success: true,
        data: {
          transactions,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch user transactions', error);
      throw new Error('Could not fetch transactions');
    }
  }

  async getPaymentStats(userId: string) {
    try {
      const [
        totalTransactions,
        successfulPayments,
        pendingPayments,
        totalAmount,
        savingsContributions,
        bookingPayments
      ] = await Promise.all([
        this.prisma.transaction.count({ where: { userId } }),
        this.prisma.transaction.count({ where: { userId, status: 'completed' } }),
        this.prisma.transaction.count({ where: { userId, status: 'pending' } }),
        this.prisma.transaction.aggregate({
          where: { userId, status: 'completed' },
          _sum: { amount: true }
        }),
        this.prisma.transaction.count({ where: { userId, category: 'savings' } }),
        this.prisma.transaction.count({ where: { userId, category: 'travel' } })
      ]);

      return {
        success: true,
        data: {
          totalTransactions,
          successfulPayments,
          pendingPayments,
          failedPayments: totalTransactions - successfulPayments - pendingPayments,
          totalAmount: totalAmount._sum.amount || 0,
          savingsContributions,
          bookingPayments
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch payment stats', error);
      throw new Error('Could not fetch payment statistics');
    }
  }

  async getPaymentById(userId: string, transactionId: string) {
    try {
      const transaction = await this.prisma.transaction.findFirst({
        where: { 
          id: transactionId,
          userId 
        },
        include: {
          saving: { include: { trip: true } },
          booking: { include: { trip: true } },
          contributions: true
        }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return {
        success: true,
        data: transaction
      };
    } catch (error) {
      this.logger.error('Failed to fetch payment', error);
      throw new Error('Could not fetch payment');
    }
  }

  async retryPayment(userId: string, transactionId: string) {
    try {
      const transaction = await this.prisma.transaction.findFirst({
        where: { 
          id: transactionId,
          userId 
        }
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Update transaction status
      const updatedTransaction = await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'pending' }
      });

      // Retry payment processing
      await this.processPayment(updatedTransaction, {
        amount: transaction.amount,
        type: transaction.type,
        provider: transaction.provider,
        category: transaction.category
      });

      return {
        success: true,
        data: updatedTransaction,
        message: 'Payment retry initiated'
      };
    } catch (error) {
      this.logger.error('Failed to retry payment', error);
      throw new Error('Could not retry payment');
    }
  }

  async cancelPayment(userId: string, transactionId: string) {
    try {
      const transaction = await this.prisma.transaction.findFirst({
        where: { 
          id: transactionId,
          userId,
          status: 'pending'
        }
      });

      if (!transaction) {
        throw new Error('Pending transaction not found');
      }

      const cancelledTransaction = await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'failed' }
      });

      return {
        success: true,
        data: cancelledTransaction,
        message: 'Payment cancelled successfully'
      };
    } catch (error) {
      this.logger.error('Failed to cancel payment', error);
      throw new Error('Could not cancel payment');
    }
  }

  async processMpesaWebhook(processWebhookDto: ProcessWebhookDto) {
    try {
      // Process M-Pesa webhook
      const { transactionId, status, reference } = processWebhookDto;

      const transaction = await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: status === 'success' ? 'completed' : 'failed',
          reference
        },
        include: {
          saving: true,
          booking: true
        }
      });

      // Update related entities based on transaction type
      if (status === 'success') {
        await this.handleSuccessfulPayment(transaction);
      }

      return {
        success: true,
        message: 'Webhook processed successfully'
      };
    } catch (error) {
      this.logger.error('Failed to process M-Pesa webhook', error);
      throw new Error('Could not process webhook');
    }
  }

  async processCardWebhook(processWebhookDto: ProcessWebhookDto) {
    try {
      // Process card payment webhook
      const { transactionId, status, reference } = processWebhookDto;

      const transaction = await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: status === 'success' ? 'completed' : 'failed',
          reference
        },
        include: {
          saving: true,
          booking: true
        }
      });

      // Update related entities based on transaction type
      if (status === 'success') {
        await this.handleSuccessfulPayment(transaction);
      }

      return {
        success: true,
        message: 'Webhook processed successfully'
      };
    } catch (error) {
      this.logger.error('Failed to process card webhook', error);
      throw new Error('Could not process webhook');
    }
  }

  async getAllPayments(page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          include: {
            user: {
              select: { name: true, email: true }
            },
            saving: { include: { trip: true } },
            booking: { include: { trip: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.transaction.count()
      ]);

      return {
        success: true,
        data: {
          transactions,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch all payments', error);
      throw new Error('Could not fetch payments');
    }
  }

  // Private methods
  private async processPayment(transaction: any, paymentData: any) {
    // Simulate payment processing based on provider
    switch (paymentData.provider) {
      case 'mpesa':
        return this.processMpesaPayment(transaction, paymentData);
      case 'card':
        return this.processCardPayment(transaction, paymentData);
      case 'bank':
        return this.processBankPayment(transaction, paymentData);
      default:
        throw new Error('Unsupported payment provider');
    }
  }

  private async processMpesaPayment(transaction: any, paymentData: any) {
    // Simulate M-Pesa payment processing
    return {
      provider: 'mpesa',
      status: 'pending',
      message: 'STK push sent to your phone'
    };
  }

  private async processCardPayment(transaction: any, paymentData: any) {
    // Simulate card payment processing
    return {
      provider: 'card',
      status: 'pending',
      message: 'Card payment processing'
    };
  }

  private async processBankPayment(transaction: any, paymentData: any) {
    // Simulate bank transfer processing
    return {
      provider: 'bank',
      status: 'pending',
      message: 'Bank transfer initiated'
    };
  }

  private async handleSuccessfulPayment(transaction: any) {
    // Update saving if this is a savings contribution
    if (transaction.savingId) {
      await this.updateSavingProgress(transaction);
    }

    // Update booking if this is a booking payment
    if (transaction.bookingId) {
      await this.updateBookingStatus(transaction);
    }

    // Create contribution record for savings
    if (transaction.type === 'savings_contribution') {
      await this.prisma.contribution.create({
        data: {
          savingId: transaction.savingId!,
          amount: transaction.amount,
          method: transaction.provider,
          status: 'completed',
          transactionId: transaction.id
        }
      });
    }
  }

  private async updateSavingProgress(transaction: any) {
    const saving = await this.prisma.saving.findUnique({
      where: { id: transaction.savingId! }
    });

    if (saving) {
      const newAmount = saving.currentAmount + transaction.amount;
      const progress = (newAmount / saving.targetAmount) * 100;

      await this.prisma.saving.update({
        where: { id: transaction.savingId! },
        data: {
          currentAmount: newAmount,
          progress,
          lastContribution: new Date(),
          isCompleted: newAmount >= saving.targetAmount
        }
      });
    }
  }

  private async updateBookingStatus(transaction: any) {
    await this.prisma.booking.update({
      where: { id: transaction.bookingId! },
      data: {
        isPaid: true,
        status: 'confirmed'
      }
    });
  }
}
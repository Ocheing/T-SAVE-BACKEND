import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateRecommendationDto } from './dto/update-recommendation.dto';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    @Inject('PrismaClient') private prisma: PrismaClient
  ) {}

  async createConversation(userId: string, createConversationDto: CreateConversationDto) {
    try {
      const conversation = await this.prisma.aiConversation.create({ // Fixed: use lowercase
        data: {
          userId,
          title: this.generateConversationTitle(createConversationDto.initialMessage),
          userContext: createConversationDto.preferences ? JSON.stringify(createConversationDto.preferences) : null,
          isActive: true,
        },
      });

      // Process initial message if provided
      if (createConversationDto.initialMessage) {
        return this.sendMessage(userId, conversation.id, {
          content: createConversationDto.initialMessage
        });
      }

      return {
        success: true,
        data: conversation
      };
    } catch (error) {
      this.logger.error('Failed to create conversation', error);
      throw new Error('Could not start conversation');
    }
  }

  async getUserConversations(userId: string, options: { page: number; limit: number }) {
    try {
      const { page, limit } = options;
      const skip = (page - 1) * limit;

      const [conversations, total] = await Promise.all([
        this.prisma.aiConversation.findMany({ // Fixed: use lowercase
          where: { userId },
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        }),
        this.prisma.aiConversation.count({ where: { userId } }), // Fixed: use lowercase
      ]);

      return {
        success: true,
        data: {
          conversations,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch user conversations', error);
      throw new Error('Could not fetch conversations');
    }
  }

  async getConversationById(userId: string, conversationId: string) {
    try {
      const conversation = await this.prisma.aiConversation.findFirst({ // Fixed: use lowercase
        where: { 
          id: conversationId,
          userId 
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          },
          recommendations: {
            include: {
              trip: true
            }
          }
        }
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      return {
        success: true,
        data: conversation
      };
    } catch (error) {
      this.logger.error('Failed to fetch conversation', error);
      throw new Error('Could not fetch conversation');
    }
  }

  async sendMessage(userId: string, conversationId: string, sendMessageDto: SendMessageDto) {
    try {
      // Verify conversation belongs to user
      const conversation = await this.prisma.aiConversation.findFirst({ // Fixed: use lowercase
        where: { 
          id: conversationId,
          userId 
        }
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Save user message
      await this.prisma.aiMessage.create({ // Fixed: use lowercase
        data: {
          conversationId,
          role: 'user',
          content: sendMessageDto.content,
        },
      });

      // Update conversation timestamp
      await this.prisma.aiConversation.update({ // Fixed: use lowercase
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });

      // Generate AI response and recommendations
      const aiResponse = await this.generateAIResponse(conversationId, sendMessageDto.content);

      return {
        success: true,
        data: aiResponse
      };
    } catch (error) {
      this.logger.error('Failed to send message', error);
      throw new Error('Could not send message');
    }
  }

  async getConversationRecommendations(userId: string, conversationId: string) {
    try {
      const conversation = await this.prisma.aiConversation.findFirst({ // Fixed: use lowercase
        where: { 
          id: conversationId,
          userId 
        },
        include: {
          recommendations: {
            include: {
              trip: true
            }
          }
        }
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      return {
        success: true,
        data: conversation.recommendations
      };
    } catch (error) {
      this.logger.error('Failed to fetch recommendations', error);
      throw new Error('Could not fetch recommendations');
    }
  }

  async updateRecommendation(userId: string, recommendationId: string, updateRecommendationDto: UpdateRecommendationDto) {
    try {
      const recommendation = await this.prisma.aiRecommendation.findFirst({ // Fixed: use lowercase
        where: { 
          id: recommendationId 
        },
        include: {
          conversation: true
        }
      });

      if (!recommendation || recommendation.conversation.userId !== userId) {
        throw new Error('Recommendation not found');
      }

      const updatedRecommendation = await this.prisma.aiRecommendation.update({ // Fixed: use lowercase
        where: { id: recommendationId },
        data: updateRecommendationDto
      });

      return {
        success: true,
        data: updatedRecommendation
      };
    } catch (error) {
      this.logger.error('Failed to update recommendation', error);
      throw new Error('Could not update recommendation');
    }
  }

  // Private methods
  private async generateAIResponse(conversationId: string, userMessage: string) {
    try {
      // Generate recommendations based on user message
      const recommendations = await this.generateRecommendations(conversationId, userMessage);
      
      // Create AI response message
      const aiMessage = await this.prisma.aiMessage.create({ // Fixed: use lowercase
        data: {
          conversationId,
          role: 'assistant',
          content: this.generateResponseContent(userMessage, recommendations.length),
        },
      });

      return {
        message: aiMessage,
        recommendations: recommendations
      };
    } catch (error) {
      this.logger.error('Failed to generate AI response', error);
      
      // Fallback response
      const fallbackMessage = await this.prisma.aiMessage.create({ // Fixed: use lowercase
        data: {
          conversationId,
          role: 'assistant',
          content: "I understand you're looking for travel recommendations. Let me help you find the perfect trip!",
        },
      });

      return {
        message: fallbackMessage,
        recommendations: []
      };
    }
  }

  private async generateRecommendations(conversationId: string, userMessage: string) {
    try {
      // Find matching trips based on user message
      const matchingTrips = await this.findMatchingTrips(userMessage);
      
      // Save recommendations
      const recommendations = await Promise.all(
        matchingTrips.map(trip =>
          this.prisma.aiRecommendation.create({ // Fixed: use lowercase
            data: {
              conversationId,
              tripId: trip.id,
              reason: this.generateRecommendationReason(userMessage, trip),
              confidence: this.calculateConfidence(userMessage, trip),
            },
            include: {
              trip: {
                include: {
                  user: {
                    select: {
                      name: true,
                      avatar: true,
                    },
                  },
                },
              },
            }
          })
        )
      );

      return recommendations;
    } catch (error) {
      this.logger.error('Failed to generate recommendations', error);
      return [];
    }
  }

  private async findMatchingTrips(userMessage: string) {
    const lowerMessage = userMessage.toLowerCase();
    
    // Search for trips using case-insensitive filtering in memory
    const allTrips = await this.prisma.trip.findMany({
      where: {
        isActive: true,
      },
      include: {
        user: {
          select: {
            name: true,
            avatar: true,
          },
        },
      },
      take: 20,
    });

    // Filter trips case-insensitively
    return allTrips.filter(trip => 
      trip.destination?.toLowerCase().includes(lowerMessage) ||
      trip.category?.toLowerCase().includes(lowerMessage) ||
      trip.activities?.toLowerCase().includes(lowerMessage) ||
      trip.title?.toLowerCase().includes(lowerMessage) ||
      trip.description?.toLowerCase().includes(lowerMessage)
    ).slice(0, 5);
  }

  private generateConversationTitle(initialMessage?: string): string {
    if (!initialMessage) return 'Travel Planning';
    
    const lowerMessage = initialMessage.toLowerCase();
    
    if (lowerMessage.includes('beach') || lowerMessage.includes('ocean') || lowerMessage.includes('sea')) {
      return 'Beach Vacation Planning';
    }
    if (lowerMessage.includes('safari') || lowerMessage.includes('wildlife') || lowerMessage.includes('animal')) {
      return 'Safari Adventure';
    }
    if (lowerMessage.includes('mountain') || lowerMessage.includes('hiking') || lowerMessage.includes('trek')) {
      return 'Mountain Adventure';
    }
    if (lowerMessage.includes('city') || lowerMessage.includes('urban') || lowerMessage.includes('metropolis')) {
      return 'City Exploration';
    }
    if (lowerMessage.includes('budget') || lowerMessage.includes('cheap') || lowerMessage.includes('affordable')) {
      return 'Budget Travel Planning';
    }
    
    return 'Travel Discussion';
  }

  private generateResponseContent(userMessage: string, recommendationCount: number): string {
    if (recommendationCount === 0) {
      return `I received your message about "${userMessage}". While I couldn't find specific trips matching your request, I'd be happy to help you explore other options. Could you tell me more about what you're looking for?`;
    }
    
    return `Based on your interest in "${userMessage}", I found ${recommendationCount} trip ${recommendationCount === 1 ? 'recommendation' : 'recommendations'} for you. These are carefully selected to match what you're looking for!`;
  }

  private generateRecommendationReason(userMessage: string, trip: any): string {
    const lowerMessage = userMessage.toLowerCase();
    const reasons: string[] = []; // Fixed: explicitly type as string array
    
    if (trip.destination?.toLowerCase().includes(lowerMessage)) {
      reasons.push(`matches your destination interest`);
    }
    if (trip.category?.toLowerCase().includes(lowerMessage)) {
      reasons.push(`aligns with your preferred travel style`);
    }
    if (trip.activities?.toLowerCase().includes(lowerMessage)) {
      reasons.push(`includes activities you mentioned`);
    }
    
    return reasons.length > 0 
      ? `This trip ${reasons.join(' and ')} from your message.`
      : `Recommended based on your travel preferences.`;
  }

  private calculateConfidence(userMessage: string, trip: any): number {
    let score = 0;
    const lowerMessage = userMessage.toLowerCase();
    
    if (trip.destination?.toLowerCase().includes(lowerMessage)) score += 0.4;
    if (trip.category?.toLowerCase().includes(lowerMessage)) score += 0.3;
    if (trip.activities?.toLowerCase().includes(lowerMessage)) score += 0.2;
    if (trip.title?.toLowerCase().includes(lowerMessage)) score += 0.1;
    
    return Math.min(score, 1.0);
  }
}
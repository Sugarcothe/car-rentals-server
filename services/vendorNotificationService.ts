import { getIO, emitToUser } from '../socket';
import Car from '../models/Car';

export class VendorNotificationService {
  // Notify vendor about new inquiry
  static async notifyNewInquiry(vendorId: string, carId: string, inquirerName: string) {
    const car = await Car.findById(carId).select('make model year price').lean();
    if (!car) return;

    emitToUser(vendorId, 'newInquiry', {
      type: 'inquiry',
      carId,
      car,
      inquirer: inquirerName,
      message: `${inquirerName} inquired about your ${car.year} ${car.make} ${car.model}`,
      timestamp: new Date(),
      priority: 'high'
    });
  }

  // Notify about car performance milestones
  static async notifyPerformanceMilestone(vendorId: string, carId: string, milestone: string) {
    const car = await Car.findById(carId).select('make model year views inquiries').lean();
    if (!car) return;

    let message = '';
    let priority: 'low' | 'medium' | 'high' = 'low';

    switch (milestone) {
      case 'high_views':
        message = `Your ${car.year} ${car.make} ${car.model} reached ${car.views} views!`;
        priority = 'medium';
        break;
      case 'multiple_inquiries':
        message = `${car.inquiries} people are interested in your ${car.year} ${car.make} ${car.model}`;
        priority = 'high';
        break;
      case 'trending':
        message = `Your ${car.year} ${car.make} ${car.model} is trending!`;
        priority = 'medium';
        break;
    }

    emitToUser(vendorId, 'performanceMilestone', {
      type: 'milestone',
      carId,
      car,
      milestone,
      message,
      timestamp: new Date(),
      priority
    });
  }

  // Notify about inventory alerts
  static async notifyInventoryAlert(vendorId: string, alertType: string, data: any) {
    let message = '';
    let priority: 'low' | 'medium' | 'high' = 'medium';

    switch (alertType) {
      case 'low_inventory':
        message = `Low inventory alert: Only ${data.count} active listings remaining`;
        priority = 'high';
        break;
      case 'stale_listings':
        message = `${data.count} listings have been active for over ${data.days} days`;
        priority = 'medium';
        break;
      case 'price_review':
        message = `${data.count} cars may need price adjustment`;
        priority = 'medium';
        break;
      case 'market_opportunity':
        message = `High demand detected for ${data.category}`;
        priority = 'low';
        break;
    }

    emitToUser(vendorId, 'inventoryAlert', {
      type: 'alert',
      alertType,
      data,
      message,
      timestamp: new Date(),
      priority
    });
  }

  // Notify about sales achievements
  static async notifySalesAchievement(vendorId: string, achievement: string, data: any) {
    let message = '';
    let priority: 'low' | 'medium' | 'high' = 'medium';

    switch (achievement) {
      case 'monthly_target':
        message = `Congratulations! You've reached your monthly sales target of ${data.target} cars`;
        priority = 'high';
        break;
      case 'revenue_milestone':
        message = `Great job! You've earned $${data.revenue.toLocaleString()} this month`;
        priority = 'high';
        break;
      case 'quick_sale':
        message = `Fast sale! Your ${data.car.year} ${data.car.make} ${data.car.model} sold in ${data.days} days`;
        priority = 'medium';
        break;
      case 'high_margin':
        message = `Excellent profit margin of ${data.margin}% on your recent sale`;
        priority = 'medium';
        break;
    }

    emitToUser(vendorId, 'salesAchievement', {
      type: 'achievement',
      achievement,
      data,
      message,
      timestamp: new Date(),
      priority
    });
  }

  // Notify about market insights
  static async notifyMarketInsight(vendorId: string, insight: any) {
    emitToUser(vendorId, 'marketInsight', {
      type: 'insight',
      insight,
      message: insight.message,
      timestamp: new Date(),
      priority: 'low'
    });
  }

  // Send daily vendor summary
  static async sendDailyVendorSummary(vendorId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStats, weeklyComparison, topPerformers] = await Promise.all([
      // Today's performance
      Car.aggregate([
        {
          $match: {
            seller: vendorId,
            $or: [
              { listedAt: { $gte: today } },
              { soldAt: { $gte: today } }
            ]
          }
        },
        {
          $group: {
            _id: null,
            newListings: {
              $sum: { $cond: [{ $gte: ['$listedAt', today] }, 1, 0] }
            },
            soldToday: {
              $sum: { $cond: [{ $gte: ['$soldAt', today] }, 1, 0] }
            },
            todayRevenue: {
              $sum: { $cond: [{ $gte: ['$soldAt', today] }, '$price', 0] }
            },
            totalViews: { $sum: '$views' },
            totalInquiries: { $sum: '$inquiries' }
          }
        }
      ]),

      // Weekly comparison
      Car.aggregate([
        {
          $match: {
            seller: vendorId,
            soldAt: {
              $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
              $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: null,
            lastWeekSales: { $sum: 1 },
            lastWeekRevenue: { $sum: '$price' }
          }
        }
      ]),

      // Top performing cars
      Car.find({
        seller: vendorId,
        status: 'active'
      })
      .sort({ views: -1, inquiries: -1 })
      .limit(3)
      .select('make model year views inquiries')
      .lean()
    ]);

    const summary = {
      today: todayStats[0] || {},
      weeklyComparison: weeklyComparison[0] || {},
      topPerformers,
      date: today.toDateString()
    };

    emitToUser(vendorId, 'dailySummary', {
      type: 'summary',
      summary,
      message: 'Your daily performance summary is ready',
      timestamp: new Date(),
      priority: 'low'
    });
  }

  // Notify about competitor pricing
  static async notifyCompetitorPricing(vendorId: string, carId: string, competitorData: any) {
    const car = await Car.findById(carId).select('make model year price').lean();
    if (!car) return;

    const priceDiff = car.price - competitorData.avgPrice;
    const percentDiff = ((priceDiff / competitorData.avgPrice) * 100).toFixed(1);

    let message = '';
    let priority: 'low' | 'medium' | 'high' = 'medium';

    if (priceDiff > 0) {
      message = `Your ${car.year} ${car.make} ${car.model} is priced ${percentDiff}% above market average`;
      priority = Math.abs(parseFloat(percentDiff)) > 15 ? 'high' : 'medium';
    } else {
      message = `Your ${car.year} ${car.make} ${car.model} is competitively priced at ${percentDiff}% below market`;
      priority = 'low';
    }

    emitToUser(vendorId, 'pricingAlert', {
      type: 'pricing',
      carId,
      car,
      competitorData,
      priceDiff,
      percentDiff,
      message,
      timestamp: new Date(),
      priority
    });
  }

  // Batch notifications for multiple vendors
  static async sendBatchNotification(vendorIds: string[], notification: any) {
    const io = getIO();
    
    vendorIds.forEach(vendorId => {
      io.to(`user_${vendorId}`).emit('batchNotification', {
        ...notification,
        timestamp: new Date()
      });
    });
  }

  // Schedule periodic notifications
  static schedulePeriodicNotifications() {
    // Send daily summaries at 9 AM
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 9 && now.getMinutes() === 0) {
        const vendors = await Car.distinct('seller', { status: 'active' });
        
        for (const vendorId of vendors) {
          await this.sendDailyVendorSummary(vendorId.toString());
        }
      }
    }, 60000); // Check every minute

    // Check for stale inventory weekly
    setInterval(async () => {
      const staleThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const staleInventory = await Car.aggregate([
        {
          $match: {
            status: 'active',
            listedAt: { $lte: staleThreshold },
            views: { $lte: 20 }
          }
        },
        {
          $group: {
            _id: '$seller',
            count: { $sum: 1 }
          }
        }
      ]);

      for (const item of staleInventory) {
        await this.notifyInventoryAlert(item._id.toString(), 'stale_listings', {
          count: item.count,
          days: 30
        });
      }
    }, 7 * 24 * 60 * 60 * 1000); // Weekly
  }
}

// Initialize periodic notifications
VendorNotificationService.schedulePeriodicNotifications();
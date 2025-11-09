import Car from '../models/Car';
import User from '../models/User';

export class VendorAnalyticsService {
  // Generate comprehensive vendor report
  static async generateVendorReport(vendorId: string, period: number = 30) {
    const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
    
    const [
      inventoryOverview,
      salesPerformance,
      marketPosition,
      customerEngagement,
      financialMetrics
    ] = await Promise.all([
      this.getInventoryOverview(vendorId),
      this.getSalesPerformance(vendorId, startDate),
      this.getMarketPosition(vendorId),
      this.getCustomerEngagement(vendorId, startDate),
      this.getFinancialMetrics(vendorId, startDate)
    ]);

    return {
      period,
      generatedAt: new Date(),
      inventoryOverview,
      salesPerformance,
      marketPosition,
      customerEngagement,
      financialMetrics,
      recommendations: await this.generateRecommendations(vendorId)
    };
  }

  // Inventory overview
  private static async getInventoryOverview(vendorId: string) {
    const overview = await Car.aggregate([
      { $match: { seller: vendorId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$price' },
          avgPrice: { $avg: '$price' },
          avgMileage: { $avg: '$mileage' },
          avgYear: { $avg: '$year' }
        }
      }
    ]);

    const byMake = await Car.aggregate([
      { $match: { seller: vendorId, status: 'active' } },
      {
        $group: {
          _id: '$make',
          count: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          totalValue: { $sum: '$price' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const ageDistribution = await Car.aggregate([
      { $match: { seller: vendorId, status: 'active' } },
      {
        $addFields: {
          daysListed: {
            $divide: [
              { $subtract: [new Date(), '$listedAt'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $bucket: {
          groupBy: '$daysListed',
          boundaries: [0, 7, 14, 30, 60, 90, Infinity],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            avgViews: { $avg: '$views' },
            avgInquiries: { $avg: '$inquiries' }
          }
        }
      }
    ]);

    return { overview, byMake, ageDistribution };
  }

  // Sales performance metrics
  private static async getSalesPerformance(vendorId: string, startDate: Date) {
    const salesData = await Car.aggregate([
      {
        $match: {
          seller: vendorId,
          soldAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$soldAt' },
            month: { $month: '$soldAt' },
            week: { $week: '$soldAt' }
          },
          count: { $sum: 1 },
          revenue: { $sum: '$price' },
          avgPrice: { $avg: '$price' },
          avgDaysToSell: {
            $avg: {
              $divide: [
                { $subtract: ['$soldAt', '$listedAt'] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } }
    ]);

    const conversionFunnel = await Car.aggregate([
      { $match: { seller: vendorId, listedAt: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          totalListings: { $sum: 1 },
          withViews: { $sum: { $cond: [{ $gt: ['$views', 0] }, 1, 0] } },
          withInquiries: { $sum: { $cond: [{ $gt: ['$inquiries', 0] }, 1, 0] } },
          sold: { $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] } }
        }
      }
    ]);

    return { salesData, conversionFunnel: conversionFunnel[0] || {} };
  }

  // Market position analysis
  private static async getMarketPosition(vendorId: string) {
    const vendorCars = await Car.find({ seller: vendorId, status: 'active' })
      .select('make model year price mileage')
      .lean();

    const marketComparisons = await Promise.all(
      vendorCars.slice(0, 5).map(async (car) => {
        const marketData = await Car.aggregate([
          {
            $match: {
              make: car.make,
              model: car.model,
              year: { $gte: car.year - 2, $lte: car.year + 2 },
              status: 'active',
              seller: { $ne: vendorId }
            }
          },
          {
            $group: {
              _id: null,
              avgPrice: { $avg: '$price' },
              minPrice: { $min: '$price' },
              maxPrice: { $max: '$price' },
              count: { $sum: 1 }
            }
          }
        ]);

        return {
          car,
          market: marketData[0] || null,
          competitive: marketData[0] ? car.price <= marketData[0].avgPrice : true
        };
      })
    );

    return { marketComparisons };
  }

  // Customer engagement metrics
  private static async getCustomerEngagement(vendorId: string, startDate: Date) {
    const engagement = await Car.aggregate([
      { $match: { seller: vendorId, listedAt: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$views' },
          totalInquiries: { $sum: '$inquiries' },
          totalFavorites: { $sum: '$favorites' },
          avgViewsPerListing: { $avg: '$views' },
          avgInquiriesPerListing: { $avg: '$inquiries' },
          engagementRate: {
            $avg: {
              $cond: [
                { $gt: ['$views', 0] },
                { $divide: ['$inquiries', '$views'] },
                0
              ]
            }
          }
        }
      }
    ]);

    const topPerformers = await Car.find({
      seller: vendorId,
      listedAt: { $gte: startDate }
    })
    .sort({ views: -1, inquiries: -1 })
    .limit(5)
    .select('make model year price views inquiries favorites')
    .lean();

    return {
      metrics: engagement[0] || {},
      topPerformers
    };
  }

  // Financial metrics
  private static async getFinancialMetrics(vendorId: string, startDate: Date) {
    const financial = await Car.aggregate([
      { $match: { seller: vendorId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$price' },
          avgValue: { $avg: '$price' }
        }
      }
    ]);

    const revenueByPeriod = await Car.aggregate([
      {
        $match: {
          seller: vendorId,
          soldAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$soldAt' },
            month: { $month: '$soldAt' }
          },
          revenue: { $sum: '$price' },
          count: { $sum: 1 },
          avgSalePrice: { $avg: '$price' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const profitMargins = await Car.aggregate([
      {
        $match: {
          seller: vendorId,
          status: 'sold',
          originalPrice: { $exists: true }
        }
      },
      {
        $addFields: {
          profit: { $subtract: ['$price', '$originalPrice'] },
          profitMargin: {
            $multiply: [
              { $divide: [{ $subtract: ['$price', '$originalPrice'] }, '$originalPrice'] },
              100
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgProfit: { $avg: '$profit' },
          avgProfitMargin: { $avg: '$profitMargin' },
          totalProfit: { $sum: '$profit' }
        }
      }
    ]);

    return {
      overview: financial,
      revenueByPeriod,
      profitability: profitMargins[0] || {}
    };
  }

  // Generate AI-powered recommendations
  private static async generateRecommendations(vendorId: string) {
    const recommendations = [];

    // Check for stale inventory
    const staleInventory = await Car.countDocuments({
      seller: vendorId,
      status: 'active',
      listedAt: { $lte: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) },
      views: { $lte: 30 }
    });

    if (staleInventory > 0) {
      recommendations.push({
        type: 'inventory',
        priority: 'high',
        title: 'Stale Inventory Alert',
        description: `You have ${staleInventory} cars listed for over 45 days with low views`,
        action: 'Consider price reduction or better photos/descriptions'
      });
    }

    // Check pricing competitiveness
    const overpriced = await Car.aggregate([
      { $match: { seller: vendorId, status: 'active' } },
      {
        $lookup: {
          from: 'cars',
          let: { make: '$make', model: '$model', year: '$year' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$make', '$$make'] },
                    { $eq: ['$model', '$$model'] },
                    { $eq: ['$year', '$$year'] },
                    { $eq: ['$status', 'active'] }
                  ]
                },
                seller: { $ne: vendorId }
              }
            },
            { $group: { _id: null, avgPrice: { $avg: '$price' } } }
          ],
          as: 'marketData'
        }
      },
      {
        $match: {
          $expr: {
            $gt: [
              '$price',
              { $multiply: [{ $arrayElemAt: ['$marketData.avgPrice', 0] }, 1.15] }
            ]
          }
        }
      }
    ]);

    if (overpriced.length > 0) {
      recommendations.push({
        type: 'pricing',
        priority: 'medium',
        title: 'Pricing Optimization',
        description: `${overpriced.length} cars may be overpriced compared to market`,
        action: 'Review and adjust pricing to be more competitive'
      });
    }

    // Check for high-performing categories
    const topCategories = await Car.aggregate([
      {
        $match: {
          seller: vendorId,
          status: 'sold',
          soldAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { make: '$make', bodyType: '$bodyType' },
          count: { $sum: 1 },
          avgDaysToSell: {
            $avg: {
              $divide: [
                { $subtract: ['$soldAt', '$listedAt'] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        }
      },
      { $match: { count: { $gte: 2 }, avgDaysToSell: { $lte: 30 } } },
      { $sort: { count: -1 } },
      { $limit: 3 }
    ]);

    if (topCategories.length > 0) {
      recommendations.push({
        type: 'opportunity',
        priority: 'medium',
        title: 'High-Performance Categories',
        description: `Focus on ${topCategories.map((c: any) => `${c._id.make} ${c._id.bodyType}`).join(', ')}`,
        action: 'Consider stocking more vehicles in these categories'
      });
    }

    return recommendations;
  }

  // Real-time dashboard metrics
  static async getRealTimeDashboard(vendorId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStats, weekStats, alerts] = await Promise.all([
      // Today's metrics
      Car.aggregate([
        {
          $match: {
            seller: vendorId,
            $or: [
              { listedAt: { $gte: today } },
              { lastUpdated: { $gte: today } },
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
            todayViews: { $sum: '$views' },
            todayInquiries: { $sum: '$inquiries' }
          }
        }
      ]),

      // Week's performance
      Car.aggregate([
        {
          $match: {
            seller: vendorId,
            listedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: null,
            weekListings: { $sum: 1 },
            weekSold: {
              $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] }
            },
            weekRevenue: {
              $sum: { $cond: [{ $eq: ['$status', 'sold'] }, '$price', 0] }
            }
          }
        }
      ]),

      // Alerts and notifications
      this.getVendorAlerts(vendorId)
    ]);

    return {
      today: todayStats[0] || {},
      week: weekStats[0] || {},
      alerts,
      lastUpdated: new Date()
    };
  }

  // Get vendor-specific alerts
  private static async getVendorAlerts(vendorId: string) {
    const alerts = [];

    // Low inventory alert
    const activeCount = await Car.countDocuments({
      seller: vendorId,
      status: 'active'
    });

    if (activeCount < 5) {
      alerts.push({
        type: 'warning',
        title: 'Low Inventory',
        message: `Only ${activeCount} active listings remaining`,
        priority: 'medium'
      });
    }

    // High interest cars
    const highInterest = await Car.find({
      seller: vendorId,
      status: 'active',
      inquiries: { $gte: 5 },
      views: { $gte: 100 }
    }).countDocuments();

    if (highInterest > 0) {
      alerts.push({
        type: 'success',
        title: 'High Interest Cars',
        message: `${highInterest} cars have high buyer interest`,
        priority: 'low'
      });
    }

    // Price reduction opportunities
    const oldListings = await Car.countDocuments({
      seller: vendorId,
      status: 'active',
      listedAt: { $lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      views: { $lte: 20 }
    });

    if (oldListings > 0) {
      alerts.push({
        type: 'info',
        title: 'Price Review Needed',
        message: `${oldListings} cars may need price adjustment`,
        priority: 'medium'
      });
    }

    return alerts;
  }
}
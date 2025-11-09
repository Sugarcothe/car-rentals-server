import { getIO, emitToLocation, emitToMakeInterests, emitToUser } from '../socket';
import Car from '../models/Car';

export class NotificationService {
  // Notify users about new listings in their area
  static async notifyNewListing(car: any) {
    const io = getIO();
    
    // Emit to location-based rooms
    emitToLocation(car.location.city, car.location.state, 'newLocalListing', {
      car,
      message: `New ${car.year} ${car.make} ${car.model} available in ${car.location.city}`
    });

    // Emit to make-specific rooms
    emitToMakeInterests(car.make, 'newMakeListing', {
      car,
      message: `New ${car.make} ${car.model} listed for $${car.price.toLocaleString()}`
    });

    // Emit to general feed
    io.emit('newCarListing', {
      car,
      message: `New ${car.year} ${car.make} ${car.model} listed`
    });
  }

  // Notify about price drops
  static async notifyPriceChange(carId: string, oldPrice: number, newPrice: number) {
    const car = await Car.findById(carId).populate('seller', 'name').lean();
    if (!car) return;

    const io = getIO();
    const priceChange = ((newPrice - oldPrice) / oldPrice) * 100;
    
    if (priceChange < -5) { // 5% or more price drop
      // Notify location-based users
      emitToLocation(car.location.city, car.location.state, 'priceAlert', {
        car,
        oldPrice,
        newPrice,
        discount: Math.abs(priceChange).toFixed(1),
        message: `Price drop: ${car.year} ${car.make} ${car.model} now $${newPrice.toLocaleString()}`
      });

      // Notify make-interested users
      emitToMakeInterests(car.make, 'priceAlert', {
        car,
        oldPrice,
        newPrice,
        discount: Math.abs(priceChange).toFixed(1)
      });
    }
  }

  // Notify seller about inquiries
  static async notifyInquiry(carId: string, inquirerName: string) {
    const car = await Car.findById(carId).lean();
    if (!car) return;

    emitToUser(car.seller.toString(), 'newInquiry', {
      carId,
      car: {
        make: car.make,
        model: car.model,
        year: car.year,
        price: car.price
      },
      inquirer: inquirerName,
      message: `${inquirerName} is interested in your ${car.year} ${car.make} ${car.model}`
    });
  }

  // Notify about similar cars when user views a listing
  static async notifySimilarCars(userId: string, viewedCar: any) {
    const similarCars = await Car.find({
      _id: { $ne: viewedCar._id },
      make: viewedCar.make,
      bodyType: viewedCar.bodyType,
      status: 'active',
      price: {
        $gte: viewedCar.price * 0.8,
        $lte: viewedCar.price * 1.2
      }
    })
    .limit(3)
    .populate('seller', 'name')
    .lean();

    if (similarCars.length > 0) {
      emitToUser(userId, 'similarCars', {
        viewedCar: {
          make: viewedCar.make,
          model: viewedCar.model,
          year: viewedCar.year
        },
        similarCars,
        message: `Found ${similarCars.length} similar cars you might like`
      });
    }
  }

  // Notify about market trends
  static async notifyMarketTrends() {
    const io = getIO();
    
    // Get trending makes (most listed in last 24 hours)
    const trending = await Car.aggregate([
      {
        $match: {
          status: 'active',
          listedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$make',
          count: { $sum: 1 },
          avgPrice: { $avg: '$price' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    if (trending.length > 0) {
      io.emit('marketTrends', {
        trending,
        message: 'Hot in the market today',
        timestamp: new Date()
      });
    }
  }

  // Send daily digest to active users
  static async sendDailyDigest() {
    const io = getIO();
    
    const [newListings, priceDrops, popularMakes] = await Promise.all([
      // New listings in last 24 hours
      Car.countDocuments({
        status: 'active',
        listedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
      
      // Cars with recent price drops
      Car.find({
        status: 'active',
        'priceHistory.1': { $exists: true }, // Has at least 2 price entries
        lastUpdated: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).limit(5).lean(),
      
      // Popular makes
      Car.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$make', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 3 }
      ])
    ]);

    io.emit('dailyDigest', {
      newListings,
      priceDrops: priceDrops.length,
      popularMakes,
      message: 'Your daily car market update',
      date: new Date().toDateString()
    });
  }
}

// Schedule daily digest (in a real app, use a job scheduler like node-cron)
setInterval(() => {
  NotificationService.sendDailyDigest();
}, 24 * 60 * 60 * 1000); // Every 24 hours

// Schedule market trends update
setInterval(() => {
  NotificationService.notifyMarketTrends();
}, 60 * 60 * 1000); // Every hour
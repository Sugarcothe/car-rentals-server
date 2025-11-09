import Car from '../models/Car';

export class SearchService {
  // Advanced search with multiple filters
  static async advancedSearch(filters: any, options: any = {}) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'listedAt',
      sortOrder = 'desc'
    } = options;

    // Build aggregation pipeline
    const pipeline: any[] = [];

    // Match stage
    const matchStage: any = { status: 'active' };
    
    if (filters.search) {
      matchStage.$text = { $search: filters.search };
    }
    
    if (filters.make) matchStage.make = new RegExp(filters.make, 'i');
    if (filters.model) matchStage.model = new RegExp(filters.model, 'i');
    
    if (filters.minPrice || filters.maxPrice) {
      matchStage.price = {};
      if (filters.minPrice) matchStage.price.$gte = Number(filters.minPrice);
      if (filters.maxPrice) matchStage.price.$lte = Number(filters.maxPrice);
    }
    
    if (filters.minYear || filters.maxYear) {
      matchStage.year = {};
      if (filters.minYear) matchStage.year.$gte = Number(filters.minYear);
      if (filters.maxYear) matchStage.year.$lte = Number(filters.maxYear);
    }
    
    if (filters.maxMileage) matchStage.mileage = { $lte: Number(filters.maxMileage) };
    if (filters.condition) matchStage.condition = filters.condition;
    if (filters.fuelType) matchStage.fuelType = filters.fuelType;
    if (filters.transmission) matchStage.transmission = filters.transmission;
    if (filters.bodyType) matchStage.bodyType = filters.bodyType;
    if (filters.drivetrain) matchStage.drivetrain = filters.drivetrain;
    
    if (filters.city) matchStage['location.city'] = new RegExp(filters.city, 'i');
    if (filters.state) matchStage['location.state'] = new RegExp(filters.state, 'i');
    
    if (filters.featured === 'true') matchStage.featured = true;
    if (filters.urgent === 'true') matchStage.urgent = true;

    pipeline.push({ $match: matchStage });

    // Add text score for search relevance
    if (filters.search) {
      pipeline.push({ $addFields: { score: { $meta: 'textScore' } } });
    }

    // Lookup seller information
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'seller',
        foreignField: '_id',
        as: 'seller',
        pipeline: [{ $project: { name: 1, email: 1, phone: 1, sellerType: 1 } }]
      }
    });

    pipeline.push({ $unwind: '$seller' });

    // Sort stage
    const sortStage: any = {};
    if (filters.search && sortBy === 'relevance') {
      sortStage.score = { $meta: 'textScore' };
    } else {
      sortStage[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }
    pipeline.push({ $sort: sortStage });

    // Facet stage for pagination and aggregations
    pipeline.push({
      $facet: {
        cars: [
          { $skip: (page - 1) * limit },
          { $limit: limit }
        ],
        totalCount: [{ $count: 'count' }],
        priceStats: [
          {
            $group: {
              _id: null,
              minPrice: { $min: '$price' },
              maxPrice: { $max: '$price' },
              avgPrice: { $avg: '$price' }
            }
          }
        ],
        makeStats: [
          { $group: { _id: '$make', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ],
        yearStats: [
          { $group: { _id: '$year', count: { $sum: 1 } } },
          { $sort: { _id: -1 } },
          { $limit: 10 }
        ]
      }
    });

    const [result] = await Car.aggregate(pipeline);
    
    return {
      cars: result.cars,
      total: result.totalCount[0]?.count || 0,
      pages: Math.ceil((result.totalCount[0]?.count || 0) / limit),
      currentPage: page,
      stats: {
        price: result.priceStats[0] || { minPrice: 0, maxPrice: 0, avgPrice: 0 },
        makes: result.makeStats,
        years: result.yearStats
      }
    };
  }

  // Get search suggestions
  static async getSearchSuggestions(query: string) {
    const suggestions = await Promise.all([
      // Make suggestions
      Car.distinct('make', {
        make: new RegExp(query, 'i'),
        status: 'active'
      }).limit(5),
      
      // Model suggestions
      Car.distinct('model', {
        model: new RegExp(query, 'i'),
        status: 'active'
      }).limit(5),
      
      // Combined make/model suggestions
      Car.find({
        $or: [
          { make: new RegExp(query, 'i') },
          { model: new RegExp(query, 'i') }
        ],
        status: 'active'
      })
      .select('make model year')
      .limit(5)
      .lean()
    ]);

    return {
      makes: suggestions[0],
      models: suggestions[1],
      cars: suggestions[2].map(car => ({
        text: `${car.year} ${car.make} ${car.model}`,
        make: car.make,
        model: car.model,
        year: car.year
      }))
    };
  }

  // Get popular searches
  static async getPopularSearches() {
    const [popularMakes, popularModels, recentSearches] = await Promise.all([
      Car.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$make', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ]),
      
      Car.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: { make: '$make', model: '$model' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        { $project: { _id: 0, make: '$_id.make', model: '$_id.model', count: 1 } }
      ]),
      
      Car.find({ status: 'active' })
        .sort({ listedAt: -1 })
        .select('make model year')
        .limit(5)
        .lean()
    ]);

    return {
      popularMakes: popularMakes.map(item => ({ make: item._id, count: item.count })),
      popularModels,
      recentListings: recentSearches.map(car => `${car.year} ${car.make} ${car.model}`)
    };
  }

  // Saved searches functionality
  static async saveSearch(userId: string, searchParams: any, name: string) {
    // In a real app, you'd save this to a SavedSearch model
    return {
      id: Date.now().toString(),
      userId,
      name,
      params: searchParams,
      createdAt: new Date()
    };
  }

  // Get similar cars based on a specific car
  static async getSimilarCars(carId: string, limit: number = 6) {
    const car = await Car.findById(carId).lean();
    if (!car) return [];

    return Car.find({
      _id: { $ne: carId },
      status: 'active',
      $or: [
        // Same make and model, different year
        { make: car.make, model: car.model },
        // Same make and body type, similar price
        {
          make: car.make,
          bodyType: car.bodyType,
          price: {
            $gte: car.price * 0.7,
            $lte: car.price * 1.3
          }
        },
        // Same body type and similar price range
        {
          bodyType: car.bodyType,
          price: {
            $gte: car.price * 0.8,
            $lte: car.price * 1.2
          }
        }
      ]
    })
    .populate('seller', 'name sellerType')
    .sort({ listedAt: -1 })
    .limit(limit)
    .lean();
  }

  // Market analysis
  static async getMarketAnalysis(make?: string, model?: string) {
    const matchStage: any = { status: 'active' };
    if (make) matchStage.make = make;
    if (model) matchStage.model = model;

    const analysis = await Car.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalListings: { $sum: 1 },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgMileage: { $avg: '$mileage' },
          avgYear: { $avg: '$year' }
        }
      }
    ]);

    // Price distribution
    const priceRanges = await Car.aggregate([
      { $match: matchStage },
      {
        $bucket: {
          groupBy: '$price',
          boundaries: [0, 10000, 20000, 30000, 50000, 75000, 100000, Infinity],
          default: 'Other',
          output: { count: { $sum: 1 } }
        }
      }
    ]);

    // Year distribution
    const yearDistribution = await Car.aggregate([
      { $match: matchStage },
      { $group: { _id: '$year', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 10 }
    ]);

    return {
      overview: analysis[0] || {},
      priceRanges,
      yearDistribution,
      generatedAt: new Date()
    };
  }
}
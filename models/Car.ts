import mongoose from 'mongoose';

const carSchema = new mongoose.Schema({
  // Basic Info
  make: { type: String, required: true, index: true },
  model: { type: String, required: true, index: true },
  year: { type: Number, required: true, index: true },
  price: { type: Number, required: true, index: true },
  originalPrice: { type: Number },
  priceHistory: [{
    price: Number,
    date: { type: Date, default: Date.now }
  }],
  
  // Vehicle Details
  mileage: { type: Number, required: true, index: true },
  condition: { type: String, required: true, enum: ['new', 'used', 'certified'] },
  fuelType: { type: String, required: true, enum: ['gasoline', 'diesel', 'hybrid', 'electric', 'plugin-hybrid'] },
  transmission: { type: String, required: true, enum: ['manual', 'automatic', 'cvt'] },
  bodyType: { type: String, required: true, enum: ['sedan', 'suv', 'hatchback', 'coupe', 'convertible', 'wagon', 'truck', 'van'] },
  
  // Engine & Performance
  enginePerformance: {
    engine: { type: String }, // e.g., "2.0L Turbo I4", "3.5L V6", "Electric Motor"
    horsepower: { type: Number },
    torque: { type: Number }, // in lb-ft
    drivetrain: { type: String, enum: ['fwd', 'rwd', 'awd', '4wd'] },
    fuelEconomy: {
      city: { type: Number }, // MPG
      highway: { type: Number }, // MPG
      combined: { type: Number } // MPG
    }
  },
  
  // Vehicle Details
  vehicleDetails: {
    seating: { type: Number, min: 1, max: 8 }, // Number of seats
    doors: { type: Number, enum: [2, 3, 4, 5] },
    exteriorColor: { 
      type: String, 
      required: true,
      enum: ['black', 'white', 'silver', 'gray', 'red', 'blue', 'green', 'brown', 'gold', 'orange', 'yellow', 'purple', 'other']
    },
    interiorColor: { 
      type: String,
      enum: ['black', 'gray', 'beige', 'brown', 'white', 'red', 'blue', 'other']
    }
  },
  
  // Location & Contact
  location: {
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  
  // Media & Description
  images: [{
    url: String,
    caption: String,
    isPrimary: { type: Boolean, default: false }
  }],
  description: { type: String, required: true },
  features: [{ type: String }],
  
  // Ownership History
  ownershipHistory: {
    vin: { type: String, unique: true, sparse: true },
    serviceRecords: [{
      date: Date,
      mileage: Number,
      serviceType: { 
        type: String, 
        enum: ['oil-change', 'brake-service', 'tire-rotation', 'transmission-service', 'engine-repair', 'electrical-repair', 'bodywork', 'inspection', 'other']
      },
      description: String,
      cost: Number,
      serviceProvider: String
    }],
    accidentRecords: [{
      date: Date,
      severity: { type: String, enum: ['minor', 'moderate', 'major'] },
      description: String,
      damageAreas: [{ type: String, enum: ['front', 'rear', 'left-side', 'right-side', 'roof', 'undercarriage'] }],
      repairCost: Number,
      insuranceClaim: Boolean
    }],
    previousOwners: { type: Number, default: 1, min: 1 },
    ownershipType: { 
      type: String, 
      enum: ['personal', 'fleet', 'rental', 'lease-return', 'government', 'taxi-uber']
    },
    titleStatus: { 
      type: String, 
      enum: ['clean', 'salvage', 'flood', 'lemon', 'rebuilt', 'other'],
      default: 'clean'
    }
  },
  
  // Warranty & Protection
  warrantyProtection: {
    warranty: {
      type: { type: String, enum: ['none', 'manufacturer', 'extended', 'dealer', 'third-party'] },
      duration: String,
      coverage: String,
      remaining: String,
      transferable: { type: Boolean, default: false }
    },
    protection: {
      gapInsurance: { type: Boolean, default: false },
      extendedWarranty: { type: Boolean, default: false },
      serviceContract: { type: Boolean, default: false },
      roadside: { type: Boolean, default: false }
    }
  },
  financing: {
    available: { type: Boolean, default: false },
    downPayment: Number,
    monthlyPayment: Number,
    term: Number,
    apr: Number
  },
  
  // Seller Info
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerType: { type: String, enum: ['private', 'dealer'], default: 'private' },
  
  // Status & Analytics
  status: { type: String, enum: ['active', 'sold', 'pending', 'inactive'], default: 'active', index: true },
  views: { type: Number, default: 0 },
  inquiries: { type: Number, default: 0 },
  favorites: { type: Number, default: 0 },
  
  // Timestamps
  listedAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  soldAt: Date,
  
  // Search optimization
  searchTags: [{ type: String }],
  featured: { type: Boolean, default: false },
  urgent: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Indexes for better query performance
carSchema.index({ make: 1, model: 1, year: 1 });
carSchema.index({ price: 1, mileage: 1 });
carSchema.index({ 'location.city': 1, 'location.state': 1 });
carSchema.index({ status: 1, listedAt: -1 });
carSchema.index({ featured: -1, listedAt: -1 });

// Text search index
carSchema.index({
  make: 'text',
  model: 'text',
  description: 'text',
  features: 'text',
  searchTags: 'text'
});

// Update lastUpdated on save
carSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

export default mongoose.model('Car', carSchema);
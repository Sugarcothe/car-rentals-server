# Car Listing API Documentation

## Overview
Comprehensive real-time car listing API with advanced search, filtering, and WebSocket notifications.

## Base URL
```
http://localhost:5000/api
```

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Car Endpoints

### GET /cars
List cars with filtering and pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `make` (string): Filter by car make
- `model` (string): Filter by car model
- `minPrice` (number): Minimum price filter
- `maxPrice` (number): Maximum price filter
- `minYear` (number): Minimum year filter
- `maxYear` (number): Maximum year filter
- `maxMileage` (number): Maximum mileage filter
- `condition` (enum): new, used, certified
- `fuelType` (enum): gasoline, diesel, hybrid, electric, plugin-hybrid
- `transmission` (enum): manual, automatic, cvt
- `bodyType` (enum): sedan, suv, hatchback, coupe, convertible, wagon, truck, van
- `city` (string): Filter by city
- `state` (string): Filter by state
- `search` (string): Text search across make, model, description
- `sortBy` (string): Sort field (default: listedAt)
- `sortOrder` (string): asc or desc (default: desc)
- `featured` (boolean): Show only featured listings

**Response:**
```json
{
  "cars": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  },
  "filters": {
    "makes": ["Toyota", "Honda", ...],
    "bodyTypes": ["sedan", "suv", ...],
    "fuelTypes": ["gasoline", "hybrid", ...]
  }
}
```

### GET /cars/search
Advanced search with comprehensive filtering.

**Query Parameters:** Same as GET /cars plus:
- `q` (string): Search query

**Response:** Enhanced search results with statistics and facets.

### GET /cars/suggestions
Get search suggestions based on query.

**Query Parameters:**
- `q` (string): Search query

**Response:**
```json
{
  "makes": ["Toyota", "Honda"],
  "models": ["Camry", "Accord"],
  "cars": [
    {
      "text": "2023 Toyota Camry",
      "make": "Toyota",
      "model": "Camry",
      "year": 2023
    }
  ]
}
```

### GET /cars/popular
Get popular searches and trending cars.

**Response:**
```json
{
  "popularMakes": [
    { "make": "Toyota", "count": 45 }
  ],
  "popularModels": [
    { "make": "Toyota", "model": "Camry", "count": 12 }
  ],
  "recentListings": ["2023 Toyota Camry", "2022 Honda Accord"]
}
```

### GET /cars/market-analysis
Get market analysis for specific make/model.

**Query Parameters:**
- `make` (string): Car make
- `model` (string): Car model

**Response:**
```json
{
  "overview": {
    "totalListings": 150,
    "avgPrice": 25000,
    "minPrice": 15000,
    "maxPrice": 45000,
    "avgMileage": 35000,
    "avgYear": 2020
  },
  "priceRanges": [...],
  "yearDistribution": [...],
  "generatedAt": "2024-01-15T10:30:00Z"
}
```

### GET /cars/:id
Get single car details with similar cars.

**Response:**
```json
{
  "car": {
    "_id": "...",
    "make": "Toyota",
    "model": "Camry",
    "year": 2023,
    "price": 28000,
    "mileage": 15000,
    "condition": "used",
    "location": {
      "city": "Los Angeles",
      "state": "CA"
    },
    "seller": {
      "name": "John Doe",
      "email": "john@example.com",
      "sellerType": "private"
    },
    "images": [...],
    "features": [...],
    "views": 45,
    "inquiries": 3,
    "favorites": 8
  },
  "similarCars": [...]
}
```

### POST /cars
Create new car listing (requires authentication).

**Request Body:**
```json
{
  "make": "Toyota",
  "model": "Camry",
  "year": 2023,
  "price": 28000,
  "mileage": 15000,
  "condition": "used",
  "fuelType": "gasoline",
  "transmission": "automatic",
  "bodyType": "sedan",
  "exteriorColor": "Silver",
  "location": {
    "city": "Los Angeles",
    "state": "CA",
    "zipCode": "90210"
  },
  "description": "Well-maintained Toyota Camry...",
  "images": [
    {
      "url": "https://example.com/image1.jpg",
      "caption": "Front view",
      "isPrimary": true
    }
  ],
  "features": ["Bluetooth", "Backup Camera", "Heated Seats"]
}
```

### PUT /cars/:id
Update car listing (requires authentication, owner only).

**Request Body:** Same as POST /cars (all fields optional).

### DELETE /cars/:id
Delete car listing (requires authentication, owner only).

### POST /cars/:id/favorite
Add car to favorites (requires authentication).

### POST /cars/:id/inquiry
Record inquiry for a car (requires authentication).

### GET /cars/stats/overview
Get market statistics overview.

**Response:**
```json
{
  "totalActive": 1250,
  "avgPrice": 25000,
  "popularMakes": [
    { "_id": "Toyota", "count": 150 }
  ],
  "recentListings": [...]
}
```

## Real-time Events (WebSocket)

Connect to Socket.IO at the same base URL. Include JWT token in auth:
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### Events You Can Listen To:

#### newCarListing
New car posted to the platform.
```json
{
  "car": {...},
  "message": "New 2023 Toyota Camry listed for $28,000"
}
```

#### newLocalListing
New car in your area (join location room first).
```json
{
  "car": {...},
  "message": "New 2023 Toyota Camry available in Los Angeles"
}
```

#### priceAlert
Price drop on cars you're interested in.
```json
{
  "car": {...},
  "oldPrice": 30000,
  "newPrice": 28000,
  "discount": "6.7",
  "message": "Price drop: 2023 Toyota Camry now $28,000"
}
```

#### newInquiry
Someone inquired about your listing (sellers only).
```json
{
  "carId": "...",
  "car": {
    "make": "Toyota",
    "model": "Camry",
    "year": 2023,
    "price": 28000
  },
  "inquirer": "Jane Smith",
  "message": "Jane Smith is interested in your 2023 Toyota Camry"
}
```

#### marketTrends
Hourly market trends update.
```json
{
  "trending": [
    { "_id": "Toyota", "count": 15, "avgPrice": 25000 }
  ],
  "message": "Hot in the market today",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

#### dailyDigest
Daily market summary.
```json
{
  "newListings": 45,
  "priceDrops": 12,
  "popularMakes": [...],
  "message": "Your daily car market update",
  "date": "Mon Jan 15 2024"
}
```

### Events You Can Emit:

#### joinLocation
Join location-based room for local updates.
```javascript
socket.emit('joinLocation', { city: 'Los Angeles', state: 'CA' });
```

#### joinInterests
Join interest-based rooms.
```javascript
socket.emit('joinInterests', {
  makes: ['Toyota', 'Honda'],
  bodyTypes: ['sedan', 'suv']
});
```

#### liveSearch
Get real-time search suggestions.
```javascript
socket.emit('liveSearch', 'Toyota Camry');
```

#### setPriceAlert
Set price alert for specific criteria.
```javascript
socket.emit('setPriceAlert', {
  make: 'Toyota',
  model: 'Camry',
  maxPrice: 25000,
  location: 'Los Angeles, CA'
});
```

## Error Responses

All endpoints return consistent error responses:
```json
{
  "message": "Error description",
  "error": "Detailed error message",
  "errors": [...] // For validation errors
}
```

## Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting
- Search endpoints: 100 requests per minute
- CRUD operations: 50 requests per minute
- Real-time connections: 10 per user

## Data Models

### Car Model
```typescript
interface Car {
  _id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  originalPrice?: number;
  priceHistory: Array<{ price: number; date: Date }>;
  mileage: number;
  condition: 'new' | 'used' | 'certified';
  fuelType: 'gasoline' | 'diesel' | 'hybrid' | 'electric' | 'plugin-hybrid';
  transmission: 'manual' | 'automatic' | 'cvt';
  bodyType: 'sedan' | 'suv' | 'hatchback' | 'coupe' | 'convertible' | 'wagon' | 'truck' | 'van';
  drivetrain?: 'fwd' | 'rwd' | 'awd' | '4wd';
  engineSize?: number;
  cylinders?: number;
  horsepower?: number;
  torque?: number;
  mpgCity?: number;
  mpgHighway?: number;
  mpgCombined?: number;
  exteriorColor: string;
  interiorColor?: string;
  seatingCapacity?: number;
  doors?: number;
  location: {
    city: string;
    state: string;
    zipCode?: string;
    coordinates?: { lat: number; lng: number };
  };
  images: Array<{
    url: string;
    caption?: string;
    isPrimary: boolean;
  }>;
  description: string;
  features: string[];
  vin?: string;
  previousOwners: number;
  accidentHistory: 'none' | 'minor' | 'major' | 'unknown';
  serviceRecords: Array<{
    date: Date;
    mileage: number;
    service: string;
    cost: number;
  }>;
  warranty: {
    type: 'none' | 'manufacturer' | 'extended' | 'dealer';
    duration?: string;
    coverage?: string;
  };
  financing: {
    available: boolean;
    downPayment?: number;
    monthlyPayment?: number;
    term?: number;
    apr?: number;
  };
  seller: string; // User ID
  sellerType: 'private' | 'dealer';
  status: 'active' | 'sold' | 'pending' | 'inactive';
  views: number;
  inquiries: number;
  favorites: number;
  listedAt: Date;
  lastUpdated: Date;
  soldAt?: Date;
  searchTags: string[];
  featured: boolean;
  urgent: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```
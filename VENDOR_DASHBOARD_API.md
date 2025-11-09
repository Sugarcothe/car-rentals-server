# Vendor Dashboard API Documentation

## Overview
Comprehensive vendor dashboard API with analytics, inventory management, lead tracking, and real-time notifications.

## Base URL
```
http://localhost:5000/api/vendors
```

## Authentication
All vendor endpoints require JWT authentication with vendor role. Include token in Authorization header:
```
Authorization: Bearer <vendor_jwt_token>
```

## Vendor Dashboard Endpoints

### GET /dashboard
Get vendor dashboard overview with key metrics and insights.

**Response:**
```json
{
  \"stats\": {
    \"active\": 25,
    \"sold\": 12,
    \"pending\": 3,
    \"inactive\": 2,
    \"totalValue\": 750000,
    \"avgPrice\": 18000,
    \"totalViews\": 1250,
    \"totalInquiries\": 89
  },
  \"recentActivity\": [
    {
      \"_id\": \"...\",
      \"make\": \"Toyota\",
      \"model\": \"Camry\",
      \"year\": 2023,
      \"price\": 28000,
      \"status\": \"active\",
      \"views\": 45,
      \"inquiries\": 3,
      \"listedAt\": \"2024-01-10T10:00:00Z\",
      \"lastUpdated\": \"2024-01-15T14:30:00Z\"
    }
  ],
  \"topPerforming\": [...],
  \"lowPerforming\": [...],
  \"insights\": {
    \"conversionRate\": \"13.5\",
    \"avgViewsPerCar\": 31,
    \"avgInquiriesPerCar\": 2
  }
}
```

### GET /analytics
Get detailed analytics with customizable time periods.

**Query Parameters:**
- `period` (number): Analysis period in days (default: 30)

**Response:**
```json
{
  \"salesTrend\": [
    {
      \"_id\": { \"year\": 2024, \"month\": 1, \"day\": 15 },
      \"count\": 2,
      \"revenue\": 45000,
      \"avgDaysToSell\": 18.5
    }
  ],
  \"priceAnalysis\": [
    {
      \"_id\": { \"make\": \"Toyota\", \"model\": \"Camry\" },
      \"count\": 5,
      \"avgPrice\": 26000,
      \"minPrice\": 22000,
      \"maxPrice\": 32000,
      \"totalViews\": 234,
      \"totalInquiries\": 18,
      \"sold\": 2
    }
  ],
  \"performanceMetrics\": {
    \"avgDaysToSell\": 22.3,
    \"avgViewsBeforeSale\": 67.5,
    \"avgInquiriesBeforeSale\": 4.2
  },
  \"inventoryAge\": [
    {
      \"_id\": \"0-7 days\",
      \"count\": 8,
      \"avgPrice\": 25000,
      \"avgViews\": 12
    }
  ],
  \"period\": 30
}
```

### GET /inventory
Manage inventory with filtering and sorting.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `status` (string): Filter by status (active, sold, pending, inactive)
- `sortBy` (string): Sort field (default: listedAt)
- `sortOrder` (string): asc or desc (default: desc)
- `search` (string): Search in make, model, or VIN

**Response:**
```json
{
  \"cars\": [
    {
      \"_id\": \"...\",
      \"make\": \"Toyota\",
      \"model\": \"Camry\",
      \"year\": 2023,
      \"price\": 28000,
      \"status\": \"active\",
      \"views\": 45,
      \"inquiries\": 3,
      \"favorites\": 8,
      \"listedAt\": \"2024-01-10T10:00:00Z\",
      \"lastUpdated\": \"2024-01-15T14:30:00Z\",
      \"images\": [...]
    }
  ],
  \"pagination\": {
    \"page\": 1,
    \"limit\": 20,
    \"total\": 42,
    \"pages\": 3
  }
}
```

### POST /bulk-update
Bulk update multiple cars at once.

**Request Body:**
```json
{
  \"carIds\": [\"car_id_1\", \"car_id_2\", \"car_id_3\"],
  \"updates\": {
    \"status\": \"inactive\",
    \"featured\": true,
    \"urgent\": false,
    \"price\": 25000
  }
}
```

**Response:**
```json
{
  \"message\": \"Updated 3 cars\",
  \"modifiedCount\": 3
}
```

### GET /leads
Lead management and tracking.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)

**Response:**
```json
{
  \"leads\": [
    {
      \"_id\": \"...\",
      \"make\": \"Toyota\",
      \"model\": \"Camry\",
      \"year\": 2023,
      \"price\": 28000,
      \"inquiries\": 5,
      \"views\": 89,
      \"favorites\": 12,
      \"listedAt\": \"2024-01-10T10:00:00Z\",
      \"leadScore\": 5.6,
      \"urgency\": \"medium\",
      \"daysListed\": 18
    }
  ],
  \"pagination\": {...}
}
```

### GET /recommendations
AI-powered recommendations for optimization.

**Response:**
```json
{
  \"underperforming\": [
    {
      \"_id\": \"...\",
      \"make\": \"Honda\",
      \"model\": \"Accord\",
      \"year\": 2022,
      \"price\": 24000,
      \"views\": 8,
      \"inquiries\": 0,
      \"listedAt\": \"2023-12-20T10:00:00Z\",
      \"suggestion\": \"Consider reducing price or improving photos/description\",
      \"priority\": \"high\"
    }
  ],
  \"pricing\": [
    {
      \"_id\": \"...\",
      \"make\": \"Toyota\",
      \"model\": \"Camry\",
      \"price\": 32000,
      \"marketPrice\": 28000,
      \"priceDiff\": 4000,
      \"suggestion\": \"Consider reducing price by $4,000\",
      \"priority\": \"medium\"
    }
  ],
  \"opportunities\": [
    {
      \"make\": \"Toyota\",
      \"bodyType\": \"sedan\",
      \"avgPrice\": 25000,
      \"avgViews\": 78,
      \"suggestion\": \"High demand for Toyota sedan - consider stocking more\",
      \"priority\": \"medium\"
    }
  ]
}
```

### GET /report
Generate comprehensive vendor performance report.

**Query Parameters:**
- `period` (number): Report period in days (default: 30)

**Response:**
```json
{
  \"period\": 30,
  \"generatedAt\": \"2024-01-15T10:00:00Z\",
  \"inventoryOverview\": {
    \"overview\": [...],
    \"byMake\": [...],
    \"ageDistribution\": [...]
  },
  \"salesPerformance\": {
    \"salesData\": [...],
    \"conversionFunnel\": {...}
  },
  \"marketPosition\": {
    \"marketComparisons\": [...]
  },
  \"customerEngagement\": {
    \"metrics\": {...},
    \"topPerformers\": [...]
  },
  \"financialMetrics\": {
    \"overview\": [...],
    \"revenueByPeriod\": [...],
    \"profitability\": {...}
  },
  \"recommendations\": [...]
}
```

### GET /realtime
Real-time dashboard metrics for live updates.

**Response:**
```json
{
  \"today\": {
    \"newListings\": 2,
    \"soldToday\": 1,
    \"todayViews\": 45,
    \"todayInquiries\": 8
  },
  \"week\": {
    \"weekListings\": 12,
    \"weekSold\": 5,
    \"weekRevenue\": 125000
  },
  \"alerts\": [
    {
      \"type\": \"warning\",
      \"title\": \"Low Inventory\",
      \"message\": \"Only 3 active listings remaining\",
      \"priority\": \"medium\"
    }
  ],
  \"lastUpdated\": \"2024-01-15T10:30:00Z\"
}
```

### GET /profile
Vendor profile and overall statistics.

**Response:**
```json
{
  \"vendor\": {
    \"_id\": \"...\",
    \"name\": \"John's Auto Sales\",
    \"email\": \"john@autosales.com\",
    \"phone\": \"+1234567890\",
    \"role\": \"vendor\",
    \"createdAt\": \"2023-06-01T10:00:00Z\"
  },
  \"stats\": {
    \"totalListings\": 156,
    \"activeListing\": 42,
    \"soldListings\": 98,
    \"totalRevenue\": 2450000,
    \"totalViews\": 12450,
    \"totalInquiries\": 892
  }
}
```

## Real-time Events (WebSocket)

Vendors receive real-time notifications through Socket.IO:

### Events Vendors Receive:

#### newInquiry
Someone inquired about a listing.
```json
{
  \"type\": \"inquiry\",
  \"carId\": \"...\",
  \"car\": {
    \"make\": \"Toyota\",
    \"model\": \"Camry\",
    \"year\": 2023,
    \"price\": 28000
  },
  \"inquirer\": \"Jane Smith\",
  \"message\": \"Jane Smith inquired about your 2023 Toyota Camry\",
  \"timestamp\": \"2024-01-15T10:30:00Z\",
  \"priority\": \"high\"
}
```

#### performanceMilestone
Car reaches performance milestone.
```json
{
  \"type\": \"milestone\",
  \"carId\": \"...\",
  \"car\": {...},
  \"milestone\": \"high_views\",
  \"message\": \"Your 2023 Toyota Camry reached 100 views!\",
  \"timestamp\": \"2024-01-15T10:30:00Z\",
  \"priority\": \"medium\"
}
```

#### inventoryAlert
Inventory management alerts.
```json
{
  \"type\": \"alert\",
  \"alertType\": \"low_inventory\",
  \"data\": { \"count\": 3 },
  \"message\": \"Low inventory alert: Only 3 active listings remaining\",
  \"timestamp\": \"2024-01-15T10:30:00Z\",
  \"priority\": \"high\"
}
```

#### salesAchievement
Sales milestones and achievements.
```json
{
  \"type\": \"achievement\",
  \"achievement\": \"monthly_target\",
  \"data\": { \"target\": 10 },
  \"message\": \"Congratulations! You've reached your monthly sales target of 10 cars\",
  \"timestamp\": \"2024-01-15T10:30:00Z\",
  \"priority\": \"high\"
}
```

#### marketInsight
Market trends and insights.
```json
{
  \"type\": \"insight\",
  \"insight\": {
    \"category\": \"Toyota sedan\",
    \"trend\": \"increasing\",
    \"message\": \"Toyota sedans are trending up 15% this week\"
  },
  \"timestamp\": \"2024-01-15T10:30:00Z\",
  \"priority\": \"low\"
}
```

#### dailySummary
Daily performance summary.
```json
{
  \"type\": \"summary\",
  \"summary\": {
    \"today\": {...},
    \"weeklyComparison\": {...},
    \"topPerformers\": [...],
    \"date\": \"Mon Jan 15 2024\"
  },
  \"message\": \"Your daily performance summary is ready\",
  \"timestamp\": \"2024-01-15T10:30:00Z\",
  \"priority\": \"low\"
}
```

#### pricingAlert
Competitive pricing alerts.
```json
{
  \"type\": \"pricing\",
  \"carId\": \"...\",
  \"car\": {...},
  \"competitorData\": {
    \"avgPrice\": 26000,
    \"minPrice\": 24000,
    \"maxPrice\": 30000
  },
  \"priceDiff\": 2000,
  \"percentDiff\": \"7.7\",
  \"message\": \"Your 2023 Toyota Camry is priced 7.7% above market average\",
  \"timestamp\": \"2024-01-15T10:30:00Z\",
  \"priority\": \"medium\"
}
```

#### inventoryUpdate
Bulk inventory updates confirmation.
```json
{
  \"updatedCount\": 5,
  \"updates\": {
    \"status\": \"inactive\",
    \"featured\": true
  }
}
```

## Dashboard Metrics Explained

### Lead Score
Calculated as: `(inquiries / views) * 100`
- Higher score indicates better conversion potential
- Scores above 5.0 are considered high-quality leads

### Urgency Levels
- **High**: Listed > 30 days with low engagement
- **Medium**: Listed 14-30 days
- **Low**: Listed < 14 days

### Conversion Rate
Calculated as: `(sold cars / total inquiries) * 100`
- Industry average: 10-15%
- Above 20% is excellent performance

### Performance Priorities
- **High**: Requires immediate attention
- **Medium**: Should be addressed soon
- **Low**: Informational/nice to know

## Error Handling

All endpoints return consistent error responses:
```json
{
  \"message\": \"Error description\",
  \"error\": \"Detailed error message\"
}
```

## Rate Limiting
- Dashboard endpoints: 100 requests per minute
- Analytics endpoints: 50 requests per minute
- Real-time updates: No limit (WebSocket)

## Best Practices

1. **Dashboard Refresh**: Poll `/realtime` endpoint every 30 seconds for live updates
2. **Analytics**: Cache analytics data for 5 minutes to reduce server load
3. **Bulk Operations**: Use bulk-update for multiple car modifications
4. **Notifications**: Subscribe to WebSocket events for instant updates
5. **Reports**: Generate comprehensive reports weekly or monthly"
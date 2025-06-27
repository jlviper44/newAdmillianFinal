# Dashboard Metrics Backend

This module handles the backend functionality for the Dashboard Metrics feature, integrating with the Affluent API to fetch affiliate data.

## Endpoints

### 1. Get Fluent APIs
- **URL**: `/api/sql/raw`
- **Method**: `POST`
- **Body**: `{ "query": "SELECT * FROM FluentAPIs" }`
- **Description**: Fetches all stored Fluent API configurations

### 2. Get Clicks Data
- **URL**: `/api/affiliate/clicks`
- **Method**: `POST`
- **Body**:
```json
{
  "api_key": "your_api_key",
  "affiliate_id": "your_affiliate_id",
  "start_date": "2024-01-01 00:00:00",
  "end_date": "2024-01-31 23:59:59",
  "fields": ["click_date", "offer", "subid_1"]
}
```

### 3. Get Conversions Data
- **URL**: `/api/affiliate/conversions`
- **Method**: `POST`
- **Body**:
```json
{
  "api_key": "your_api_key",
  "affiliate_id": "your_affiliate_id",
  "start_date": "2024-01-01 00:00:00",
  "end_date": "2024-01-31 23:59:59",
  "fields": ["conversion_date", "offer_name", "subid_1", "price"]
}
```

### 4. Get Subaffiliate Summary
- **URL**: `/api/affiliate/subaffiliatesummary`
- **Method**: `POST`
- **Body**:
```json
{
  "api_key": "your_api_key",
  "affiliate_id": "your_affiliate_id",
  "start_date": "2024-01-01 00:00:00",
  "end_date": "2024-01-31 23:59:59",
  "fields": ["sub_id", "clicks", "conversions", "revenue", "epc", "events", "date"]
}
```

### 5. Manage Fluent APIs (Protected)
- **URL**: `/api/metrics/fluent-apis`
- **Methods**: 
  - `GET`: Get all Fluent APIs
  - `POST`: Add a new Fluent API
- **POST Body**:
```json
{
  "name": "Production API",
  "api_key": "your_affluent_api_key",
  "affiliate_id": "your_affiliate_id"
}
```

## Adding Test APIs

To add test Fluent APIs to your database, you can use the following SQL command:

```sql
INSERT INTO FluentAPIs (name, api_key, affiliate_id) VALUES 
('Production API', 'prod_api_key_here', 'prod_affiliate_id'),
('Staging API', 'staging_api_key_here', 'staging_affiliate_id');
```

Or use the API endpoint:
```bash
curl -X POST https://your-domain.com/api/metrics/fluent-apis \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_cookie" \
  -d '{
    "name": "Production API",
    "api_key": "your_api_key",
    "affiliate_id": "your_affiliate_id"
  }'
```

## Database Schema

The module creates a `FluentAPIs` table with the following structure:
- `id`: Auto-incrementing primary key
- `name`: Display name for the API
- `api_key`: Affluent API key
- `affiliate_id`: Affiliate ID for filtering
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

## Notes

1. The affiliate API endpoints (`/api/affiliate/*`) are not protected by authentication to allow the frontend to fetch data directly.
2. The management endpoints (`/api/metrics/*`) require authentication.
3. Date format for API requests should be `YYYY-MM-DD HH:MM:SS`.
4. The Affluent API documentation can be found at: https://login.affluentco.com/affiliates/api/docs
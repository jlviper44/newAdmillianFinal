// Test script to create sample click data for activity log testing
const axios = require('axios');

async function createTestData() {
  const baseUrl = 'http://localhost:8787';
  
  // First, we need to authenticate (you'll need to implement this based on your auth system)
  // For now, let's assume you have a valid session
  
  // Create some test clicks
  const testClicks = [
    {
      ip_address: '192.168.1.100',
      country: 'United States',
      city: 'New York',
      device_type: 'Desktop',
      clicked_url: 'https://example.com/page1',
      referrer: 'https://google.com',
      fraud_score: 10,
      is_bot: false
    },
    {
      ip_address: '10.0.0.50',
      country: 'Canada',
      city: 'Toronto',
      device_type: 'Mobile',
      clicked_url: 'https://example.com/page2',
      referrer: 'https://facebook.com',
      fraud_score: 85,
      is_bot: true
    },
    {
      ip_address: '172.16.0.25',
      country: 'United Kingdom',
      city: 'London',
      device_type: 'Tablet',
      clicked_url: 'https://example.com/page3',
      referrer: 'https://twitter.com',
      fraud_score: 45,
      is_bot: false
    }
  ];

  console.log('This script would normally insert test data.');
  console.log('Since we need proper authentication, you should:');
  console.log('1. Create a test project in the UI');
  console.log('2. Create test links');
  console.log('3. Visit the short links to generate click data');
  console.log('\nAlternatively, manually insert data into the link_clicks table in your database.');
}

createTestData();
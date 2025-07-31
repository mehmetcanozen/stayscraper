// Test script for Akra Antalya hotel with improved HotelsComScraper
// This script tests the anti-captcha/anti-detection features

// Import the compiled JavaScript module
const { HotelsComScraper } = require('./dist/services/scraping/HotelsComScraper.js');

async function testAkraAntalya() {
  const scraper = new HotelsComScraper();
  
  try {
    console.log('🚀 Starting Akra Antalya test with anti-detection measures...');
    
    // Initialize scraper with advanced anti-detection
    await scraper.initialize();
    console.log('✅ Scraper initialized successfully');
    
    // Test parameters for Akra Antalya
    const searchParams = {
      checkInDate: '2025-08-07',
      checkOutDate: '2025-08-13',
      adults: 2,
      children: 1,
      childAges: [8]
    };
    
    console.log('🏨 Testing hotel: Akra Antalya');
    console.log('📅 Search params:', searchParams);
    
    // Attempt to scrape Akra Antalya
    const result = await scraper.scrapeHotelDetails('Akra Antalya', searchParams);
    
    if (result) {
      console.log('🎉 SUCCESS! Hotel data scraped successfully');
      console.log('📊 Results summary:');
      console.log(`   Hotel: ${result.hotelName}`);
      console.log(`   Hotel ID: ${result.hotelId}`);
      console.log(`   Rooms found: ${result.rooms.length}`);
      console.log(`   Scraped at: ${result.scrapedAt}`);
      
      if (result.rooms.length > 0) {
        console.log('💰 Sample room prices:');
        result.rooms.slice(0, 3).forEach((room, index) => {
          console.log(`   ${index + 1}. ${room.roomName}: ${room.price} ${room.currency}`);
        });
      }
      
      // Save the result
      const savedPath = await scraper.saveScrapedData(result);
      console.log(`💾 Data saved to: ${savedPath}`);
      
    } else {
      console.log('❌ FAILED: No data could be scraped');
    }
    
  } catch (error) {
    console.error('💥 ERROR during scraping:', error.message);
    
    if (error.message.includes('Captcha')) {
      console.log('🤖 CAPTCHA DETECTED - This indicates the anti-detection measures need further improvement');
      console.log('💡 Suggestions:');
      console.log('   - Try running the script again (sometimes captchas are random)');
      console.log('   - Consider using residential proxies');
      console.log('   - Implement additional delays between requests');
    }
    
  } finally {
    // Always close the browser
    await scraper.close();
    console.log('🔒 Browser closed');
  }
}

// Run the test
console.log('🧪 Starting Hotels.com Anti-Detection Test');
console.log('🎯 Target: Akra Antalya Hotel');
console.log('🛡️ Features: Stealth plugin, human-like behavior, captcha detection');
console.log('=' .repeat(60));

testAkraAntalya()
  .then(() => {
    console.log('=' .repeat(60));
    console.log('✅ Test completed');
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });

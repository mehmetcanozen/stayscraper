const { TatilsepetiScraper } = require('./dist/services/scraping/TatilsepetiScraper.js');

async function testTatilsepetiScraperWithChildren() {
  console.log('🚀 Starting Tatilsepeti scraper test with children...');
  
  const scraper = new TatilsepetiScraper();
  
  try {
    // Initialize scraper
    await scraper.initialize(false); // false = visible browser for debugging
    
    // Test parameters - 2 adults, 2 children (ages 6 and 8)
    const searchParams = {
      hotelName: 'adalya-ocean-deluxe',
      checkInDate: '31.07.2025',
      checkOutDate: '20.08.2025',
      adults: 2,
      children: 2,
      childAges: [6, 8] // 2 children of ages 6 and 8
    };
    
    // Test search flow
    console.log('🔍 Testing search flow with children...');
    await scraper.searchHotels(searchParams);
    
    // Test basic scraping
    console.log('🔍 Testing basic scraping...');
    const scrapedData = await scraper.scrapeHotelDetails();
    
    if (scrapedData.success) {
      console.log('✅ Basic scraping successful!');
      console.log('🏨 Hotel name:', scrapedData.hotelName);
      console.log(`🏨 Found ${scrapedData.rooms?.length || 0} rooms:`);
      
      if (scrapedData.rooms && scrapedData.rooms.length > 0) {
        scrapedData.rooms.forEach((room, index) => {
          console.log(`\n📋 Room ${index + 1}:`);
          console.log(`   Name: ${room.name}`);
          console.log(`   Size: ${room.size}`);
          console.log(`   Concept: ${room.concept}`);
          console.log(`   Total Price: ${room.totalPrice}`);
          console.log(`   Discounted Price: ${room.discountedPrice}`);
          console.log(`   Discount: ${room.discount}`);
          console.log(`   Capacity: ${room.capacity}`);
          console.log(`   Available: ${room.available}`);
          console.log(`   Features: ${room.features?.join(', ') || 'None'}`);
        });
      }
      
      // Save the scraped data
      console.log('💾 Saving scraped data...');
      const savedFilePath = await scraper.saveScrapedData(scrapedData, searchParams);
      console.log('✅ Data saved successfully!');
      
    } else {
      console.log('❌ Basic scraping failed:', scrapedData.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await scraper.close();
    console.log('✅ Test completed');
  }
}

testTatilsepetiScraperWithChildren(); 
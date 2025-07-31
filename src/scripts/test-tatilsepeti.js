const { TatilsepetiScraper } = require('./dist/services/scraping/TatilsepetiScraper.js');

async function testTatilsepetiScraper() {
  console.log('🚀 Starting Tatilsepeti scraper test (BOTH normal + detailed)...');
  
  const scraper = new TatilsepetiScraper();
  
  try {
    // Initialize scraper
    await scraper.initialize(false); // false = visible browser for debugging
    
    // Test parameters - 2 adults, 0 children
    const searchParams = {
      hotelName: 'adalya-ocean-deluxe',
      checkInDate: '31.07.2025',
      checkOutDate: '20.08.2025',
      adults: 2,
      children: 0,
      childAges: [] // No children
    };
    
    // Test search flow
    console.log('🔍 Testing search flow...');
    await scraper.searchHotels(searchParams);
    
    // Test NORMAL scraping (basic room data without modals)
    console.log('🔍 Testing NORMAL scraping (basic room data only)...');
    const scrapedData = await scraper.scrapeHotelDetails();
    
    if (scrapedData.success) {
      console.log('✅ Normal scraping successful!');
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
      
      // Test DETAILED scraping (opens modals for comprehensive pricing)
      console.log('🔍 Testing DETAILED scraping (opens modals for comprehensive pricing)...');
      const detailedPrices = await scraper.scrapeDetailedPrices();
      console.log(`💰 Found detailed prices for ${detailedPrices.length} rooms`);
      
      // Combine basic room data with detailed pricing data
      if (scrapedData.rooms && detailedPrices.length > 0) {
        scrapedData.rooms.forEach((room, index) => {
          const detailedPriceData = detailedPrices.find(dp => dp.roomIndex === index);
          if (detailedPriceData) {
            room.detailedPricing = detailedPriceData;
          }
        });
      }
      
      // Add detailed prices to the main data structure
      scrapedData.detailedPrices = detailedPrices;
      
      // Save the scraped data
      console.log('💾 Saving scraped data...');
      const savedFilePath = await scraper.saveScrapedData(scrapedData, searchParams);
      console.log('✅ Data saved successfully!');
      
    } else {
      console.log('❌ Normal scraping failed:', scrapedData.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await scraper.close();
    console.log('✅ Test completed');
  }
}

testTatilsepetiScraper(); 
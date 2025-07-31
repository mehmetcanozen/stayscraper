const { TatilBudurScraper } = require('./dist/services/scraping/TatilBudurScraper.js');

async function testTatilBudurScraper() {
  console.log('🚀 Starting TatilBudur scraper test...');
  
  const scraper = new TatilBudurScraper();
  
  try {
    // Initialize scraper
    await scraper.initialize(false); // false = visible browser for debugging
    
         // Test parameters
     const searchParams = {
   hotelName: 'fashiontv-luxe-resort',
   checkInDate: '21.08.2025',
   checkOutDate: '23.08.2025',
   adults: 2,
   children: 0,
   childAges: [] // No children
 };
    
    // Test search flow
    console.log('🔍 Testing search flow...');
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
          console.log(`   Price: ${room.price}`);
          console.log(`   Original Price: ${room.originalPrice}`);
          console.log(`   TB Points: ${room.tbPoints}`);
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

testTatilBudurScraper(); 
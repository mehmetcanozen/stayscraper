const { EnuygunScraper } = require('./dist/services/scraping/EnuygunScraper.js');

async function testEnuygunScraper() {
  const scraper = new EnuygunScraper();
  
  try {
    console.log('🚀 Starting Enuygun scraper test...');
    
    // Initialize scraper (non-headless for debugging)
    await scraper.initialize(false);
    
    // Test search parameters
    const searchParams = {
      hotelName: 'Concorde De Luxe Resort Lara Antalya',
      checkInDate: '30.07.2025',
      checkOutDate: '05.08.2025',
      adults: 2,
      children: 0
    };
    
    console.log('🔍 Testing search flow...');
    
    // Test the search flow
    const searchSuccess = await scraper.searchHotels(searchParams);
    
    if (searchSuccess) {
      console.log('✅ Search flow completed successfully!');
      
      // Test navigating to specific hotel
      console.log('🏨 Testing navigation to specific hotel...');
      const navigationSuccess = await scraper.navigateToSpecificHotel('Concorde De Luxe Resort Lara Antalya');
      
      if (navigationSuccess) {
        console.log('✅ Navigation to specific hotel successful!');
        
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
              console.log(`   Original Price: ${room.originalPrice}`);
              console.log(`   Final Price: ${room.finalPrice}`);
              console.log(`   Discount: ${room.discountLabel}`);
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
      } else {
        console.log('❌ Navigation to specific hotel failed');
      }
    } else {
      console.log('❌ Search flow failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close the scraper
    await scraper.close();
    console.log('✅ Test completed');
  }
}

// Run the test
testEnuygunScraper(); 
const { SeturScraper } = require('./dist/services/scraping/SeturScraper');

async function testSeturScraper() {
  const scraper = new SeturScraper();
  
  try {
    console.log('🚀 Starting Setur scraper test...');
    
    // Initialize scraper in non-headless mode to avoid detection
    await scraper.initialize(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      false // non-headless mode to avoid detection
    );
    
    console.log('✅ Scraper initialized successfully');
    
    // Test parameters
    const params = {
      hotelSlug: 'marti-myra-kemer',
      checkIn: '2025-07-31',
      checkOut: '2025-08-14',
      adults: 2,
      childBirthdates: [],
      headless: false
    };
    
    console.log('🔍 Scraping hotel rooms...');
    console.log('Hotel:', params.hotelSlug);
    console.log('Dates:', params.checkIn, 'to', params.checkOut);
    console.log('Guests:', params.adults, 'adults');
    
    // Scrape rooms
    const rooms = await scraper.scrapeHotelRooms(params);
    
    console.log(`\n📊 Results:`);
    console.log(`Found ${rooms.length} rooms`);
    
    if (rooms.length > 0) {
      console.log('\n🏨 Room Details:');
      rooms.forEach((room, index) => {
        console.log(`${index + 1}. ${room.name}`);
        console.log(`   Price: ${room.price || 'N/A'}`);
        if (room.roomType) console.log(`   Type: ${room.roomType}`);
        if (room.boardType) console.log(`   Board: ${room.boardType}`);
        if (room.capacity) console.log(`   Capacity: ${room.capacity}`);
        console.log('');
      });
      
      // Save data
      const filePath = await scraper.saveScrapedData(
        params.hotelSlug,
        params.checkIn,
        params.checkOut,
        rooms
      );
      console.log(`💾 Data saved to: ${filePath}`);
    } else {
      console.log('❌ No rooms found. Check the screenshots for debugging.');
    }
    
  } catch (error) {
    console.error('❌ Error during scraping:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    // Close browser
    await scraper.close();
    console.log('🔒 Browser closed');
  }
}

// Run the test
testSeturScraper().then(() => {
  console.log('✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
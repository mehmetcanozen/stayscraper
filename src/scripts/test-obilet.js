const { ObiletScraper } = require('./dist/services/scraping/ObiletScraper');

async function testObiletScraper() {
  const scraper = new ObiletScraper();
  
  try {
    console.log('Initializing Obilet scraper...');
    await scraper.initialize();
    
    const searchParams = {
      checkInDate: '2025-07-31',
      checkOutDate: '2025-08-01',
      adults: 2,
      children: 1,
      childAges: [5]
    };
    
    console.log('Testing with Club Hotel Sera...');
    const result = await scraper.scrapeHotelDetails('Club Hotel Sera', searchParams);
    
    if (result) {
      console.log('Scraping successful!');
      console.log(`Hotel: ${result.hotelName}`);
      console.log(`Hotel ID: ${result.hotelId}`);
      console.log(`Rooms found: ${result.rooms.length}`);
      
      // Save the scraped data
      const filePath = await scraper.saveScrapedData(result);
      console.log(`Data saved to: ${filePath}`);
      
      // Show first few rooms
      result.rooms.slice(0, 3).forEach((room, index) => {
        console.log(`Room ${index + 1}: ${room.roomName} - ${room.price} ${room.currency} (${room.boardType})`);
      });
    } else {
      console.log('Scraping failed');
    }
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await scraper.close();
  }
}

testObiletScraper(); 
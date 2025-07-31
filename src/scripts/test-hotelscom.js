const { HotelsComScraper } = require('./dist/services/scraping/HotelsComScraper');

async function testHotelsComScraper() {
  const scraper = new HotelsComScraper();

  try {
    console.log('🚀 Hotels.com scraper test başlatılıyor...');
    await scraper.initialize();

    const hotelName = 'Concorde De Luxe Resort Lara Antalya - Prive Ultra All Inclusive';
    const searchParams = {
      checkInDate: '2025-08-07',
      checkOutDate: '2025-08-13',
      adults: 2,
      children: 1,
      childAges: [5]
    };

    console.log(`🏨 Hotel: ${hotelName}`);
    console.log(`📅 Tarihler: ${searchParams.checkInDate} - ${searchParams.checkOutDate}`);
    console.log(`👥 Misafirler: ${searchParams.adults} yetişkin, ${searchParams.children} çocuk (${searchParams.childAges.join(', ')} yaş)`);

    console.log('\n🔍 Hotel verileri kazınıyor...');
    const scrapedData = await scraper.scrapeHotelDetails(hotelName, searchParams);

    if (scrapedData && scrapedData.rooms.length > 0) {
      console.log(`✅ Kazıma başarılı!`);
      console.log(`🏨 Hotel: ${scrapedData.hotelName}`);
      console.log(`🆔 Hotel ID: ${scrapedData.hotelId}`);
      console.log(`🛏️ Bulunan oda sayısı: ${scrapedData.rooms.length}`);

      const filePath = await scraper.saveScrapedData(scrapedData);
      console.log(`💾 Veri kaydedildi: ${filePath}`);

      console.log('\n📋 Oda Detayları:');
      scrapedData.rooms.forEach((room, index) => {
        console.log(`\n${index + 1}. ${room.roomName}`);
        console.log(`   💰 Fiyat: ${room.price} ${room.currency}`);
        if (room.originalPrice && room.discountPercentage) {
          console.log(`   🏷️ Orijinal: ${room.originalPrice} ${room.currency} (%${room.discountPercentage} indirim)`);
        }
        console.log(`   👥 Kapasite: ${room.capacity} kişi`);
        if (room.bedType) console.log(`   🛏️ Yatak: ${room.bedType}`);
        if (room.boardType) console.log(`   🍽️ Pansiyon: ${room.boardType}`);
        if (room.cancellationPolicy) console.log(`   📋 İptal: ${room.cancellationPolicy}`);
        if (room.attributes.length > 0) {
          console.log(`   ✨ Özellikler: ${room.attributes.slice(0, 3).join(', ')}${room.attributes.length > 3 ? '...' : ''}`);
        }
      });

    } else {
      console.log('❌ Kazıma başarısız: Oda verisi bulunamadı');
    }

  } catch (error) {
    console.error('❌ Test sırasında hata:', error.message);
  } finally {
    await scraper.close();
    console.log('\n🔚 Hotels.com scraper kapatıldı');
  }
}

testHotelsComScraper(); 
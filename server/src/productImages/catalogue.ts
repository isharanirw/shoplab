import type { ProductArt } from './compose';

/**
 * Which illustration each seeded product gets. `motif` names a drawing in the motif library; `colours` are the main
 * colour, the colour of the third picture and (optionally) a third colour for the smaller copy in it. Where a
 * product has colour variants the colours come from those variants. The category must match the seed data.
 */
export const PRODUCT_ART: ProductArt[] = [
  // Electronics
  { id: 1, category: 'Electronics', motif: 'headphones', colours: ['Navy', 'Red', 'Black'] },
  { id: 2, category: 'Electronics', motif: 'speaker', colours: ['Teal', 'Orange', 'Charcoal'] },
  { id: 3, category: 'Electronics', motif: 'charger', colours: ['White', 'Charcoal', 'Light Blue'] },
  { id: 4, category: 'Electronics', motif: 'deskLamp', colours: ['White', 'Orange', 'Charcoal'] },
  { id: 5, category: 'Electronics', motif: 'keyboard', colours: ['Charcoal', 'Navy', 'Silver'] },
  { id: 6, category: 'Electronics', motif: 'mouse', colours: ['Charcoal', 'Blue', 'Silver'] },
  { id: 7, category: 'Electronics', motif: 'actionCamera', colours: ['Charcoal', 'Navy', 'Orange'] },
  { id: 8, category: 'Electronics', motif: 'powerBank', colours: ['Navy', 'Silver', 'Teal'] },
  { id: 9, category: 'Electronics', motif: 'phoneCase', colours: ['Black', 'Blue', 'Red'] },
  { id: 10, category: 'Electronics', motif: 'curvedMonitor', colours: ['Charcoal', 'Navy'] },
  // Clothing
  { id: 11, category: 'Clothing', motif: 'tshirt', colours: ['White', 'Black', 'Blue'] },
  { id: 12, category: 'Clothing', motif: 'jeans', colours: ['Denim', 'Black', 'Navy'] },
  { id: 13, category: 'Clothing', motif: 'hoodie', colours: ['Grey', 'Navy', 'Burgundy'] },
  { id: 14, category: 'Clothing', motif: 'belt', colours: ['Brown', 'Black', 'Wood'] },
  { id: 15, category: 'Clothing', motif: 'scarf', colours: ['Red', 'Teal', 'Grey'] },
  { id: 16, category: 'Clothing', motif: 'socks', colours: ['White', 'Blue', 'Grey'] },
  { id: 17, category: 'Clothing', motif: 'dress', colours: ['Red', 'Blue', 'Pink'] },
  { id: 18, category: 'Clothing', motif: 'denimJacket', colours: ['Denim', 'Navy', 'Light Blue'] },
  { id: 19, category: 'Clothing', motif: 'oxfordShirt', colours: ['White', 'Light Blue', 'Grey'] },
  { id: 20, category: 'Clothing', motif: 'pyjamas', colours: ['Grey', 'Navy', 'Pink'] },
  // Home
  { id: 21, category: 'Home', motif: 'plates', colours: ['Cream', 'Light Blue', 'White'] },
  { id: 22, category: 'Home', motif: 'bottle', colours: ['Silver', 'Black', 'Blue'] },
  { id: 23, category: 'Home', motif: 'tableLamp', colours: ['Cream', 'Orange', 'Teal'] },
  { id: 24, category: 'Home', motif: 'pillow', colours: ['White', 'Light Blue', 'Cream'] },
  { id: 25, category: 'Home', motif: 'blanket', colours: ['Cream', 'Teal', 'Orange'] },
  { id: 26, category: 'Home', motif: 'candles', colours: ['Cream', 'Pink', 'Orange'] },
  { id: 27, category: 'Home', motif: 'robotVacuum', colours: ['Charcoal', 'Silver', 'Navy'] },
  { id: 28, category: 'Home', motif: 'cuttingBoard', colours: ['Wood', 'Brown', 'Beige'] },
  { id: 29, category: 'Home', motif: 'skillet', colours: ['Charcoal', 'Black', 'Brown'] },
  { id: 30, category: 'Home', motif: 'rug', colours: ['Grey', 'Beige', 'Teal'] },
  // Sports
  { id: 31, category: 'Sports', motif: 'yogaMat', colours: ['Purple', 'Green', 'Black'] },
  { id: 32, category: 'Sports', motif: 'dumbbells', colours: ['Black', 'Orange', 'Grey'] },
  { id: 33, category: 'Sports', motif: 'trailShoes', colours: ['Black', 'Orange', 'Grey'] },
  { id: 34, category: 'Sports', motif: 'helmet', colours: ['Black', 'White', 'Orange'] },
  { id: 35, category: 'Sports', motif: 'tent', colours: ['Orange', 'Teal', 'Olive'] },
  { id: 36, category: 'Sports', motif: 'football', colours: ['Black', 'Blue', 'Red'] },
  { id: 37, category: 'Sports', motif: 'tennisRacket', colours: ['Red', 'Blue', 'Black'] },
  { id: 38, category: 'Sports', motif: 'resistanceBands', colours: ['Black', 'Purple', 'Green'] },
  { id: 39, category: 'Sports', motif: 'backpack', colours: ['Olive', 'Orange', 'Navy'] },
  { id: 40, category: 'Sports', motif: 'jumpRope', colours: ['Red', 'Blue', 'Green'] },
  // Books
  { id: 41, category: 'Books', motif: 'bookTester', colours: ['Teal', 'Navy', 'Orange'] },
  { id: 42, category: 'Books', motif: 'bookMystery', colours: ['Navy', 'Charcoal', 'Burgundy'] },
  { id: 43, category: 'Books', motif: 'bookAurora', colours: ['Charcoal', 'Navy', 'Purple'] },
  { id: 44, category: 'Books', motif: 'bookCooking', colours: ['Orange', 'Red', 'Teal'] },
  { id: 45, category: 'Books', motif: 'bookTypeScript', colours: ['Blue', 'Navy', 'Teal'] },
  { id: 46, category: 'Books', motif: 'bookGarden', colours: ['Green', 'Teal', 'Olive'] },
  { id: 47, category: 'Books', motif: 'bookAtlas', colours: ['Teal', 'Navy', 'Blue'] },
  { id: 48, category: 'Books', motif: 'bookBedtime', colours: ['Purple', 'Navy', 'Pink'] },
  { id: 49, category: 'Books', motif: 'bookFinance', colours: ['Green', 'Navy', 'Burgundy'] },
  { id: 50, category: 'Books', motif: 'bookPoetry', colours: ['Burgundy', 'Navy', 'Green'] },
  // Toys
  { id: 51, category: 'Toys', motif: 'blocks', colours: ['Red', 'Blue', 'Green'] },
  { id: 52, category: 'Toys', motif: 'rcCar', colours: ['Red', 'Blue', 'Green'] },
  { id: 53, category: 'Toys', motif: 'jigsaw', colours: ['Blue', 'Green', 'Orange'] },
  { id: 54, category: 'Toys', motif: 'teddy', colours: ['Brown', 'White', 'Beige'] },
  { id: 55, category: 'Toys', motif: 'boardGame', colours: ['Blue', 'Green', 'Red'] },
  { id: 56, category: 'Toys', motif: 'craftKit', colours: ['Wood', 'Beige', 'Brown'] },
  { id: 57, category: 'Toys', motif: 'trainSet', colours: ['Red', 'Blue', 'Green'] },
  { id: 58, category: 'Toys', motif: 'scienceKit', colours: ['Green', 'Purple', 'Teal'] },
  { id: 59, category: 'Toys', motif: 'drawingBoard', colours: ['Red', 'Blue', 'Green'] },
  { id: 60, category: 'Toys', motif: 'dinosaur', colours: ['Green', 'Purple', 'Teal'] },
];

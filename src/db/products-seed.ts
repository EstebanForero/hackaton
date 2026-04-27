import type { NewProduct, Product } from './schema'

type SeedInput = {
  name: string
  slug: string
  category: Product['category']
  price: string
  imageUrl: string
  imageAlt: string
  imageDescription: string
  colors: string[]
  sizes: string[]
  material: string
  styleTags: string[]
}

function product(input: SeedInput): NewProduct {
  return {
    ...input,
    currency: 'COP',
    shortDescription: `${input.name} inspired by Colombian retail styling.`,
    description: `${input.name} selected for the in-store AI catalog. The piece is easy to combine and has a clear garment shape for recommendation and virtual try-on flows.`,
    inventory: 30 + (input.slug.length % 45),
  }
}

const shirtSizes = ['S', 'M', 'L', 'XL']
const pantSizes = ['28', '30', '32', '34', '36', '38', '40']
const jacketSizes = ['S', 'M', 'L', 'XL', 'XXL']
const kidsSizes = ['8', '10', '12', '14', '16']

export const productSeed: NewProduct[] = [
  product({
    name: 'White Print Shirt',
    slug: 'ac-white-print-shirt',
    category: 'tops',
    price: '129900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/871804/HOMBRE-CAMISA-10148260-BLANCO-000_1.jpg?v=639111256517630000',
    imageAlt: 'White printed long sleeve shirt from Arturo Calle',
    imageDescription:
      'White long sleeve button-up shirt with a small printed pattern, pointed collar, front buttons, and regular straight fit.',
    colors: ['white'],
    sizes: shirtSizes,
    material: 'Cotton blend',
    styleTags: ['shirt', 'business', 'printed', 'regular-fit'],
  }),
  product({
    name: 'Green Casual Shirt',
    slug: 'ac-green-casual-shirt',
    category: 'tops',
    price: '159990.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/877589/HOMBRE-CAMISA-10154925-VERDE-899_1.jpg?v=639113421751530000',
    imageAlt: 'Green casual button-up shirt from Arturo Calle',
    imageDescription:
      'Green long sleeve casual shirt with semi slim fit, button front, soft collar, and clean woven texture.',
    colors: ['green'],
    sizes: shirtSizes,
    material: 'Cotton blend',
    styleTags: ['shirt', 'casual', 'green', 'semi-slim'],
  }),
  product({
    name: 'White Slim Shirt',
    slug: 'ac-white-slim-shirt',
    category: 'tops',
    price: '159900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/881951/HOMBRE-CAMISA-10152632-BLANCO-000_1.jpg?v=639123064498770000',
    imageAlt: 'White semi slim shirt from Arturo Calle',
    imageDescription:
      'White semi slim button-up shirt with long sleeves, crisp collar, front placket, and clean office-ready silhouette.',
    colors: ['white'],
    sizes: shirtSizes,
    material: 'Cotton',
    styleTags: ['shirt', 'business', 'white', 'minimal'],
  }),
  product({
    name: 'Habano Resort Shirt',
    slug: 'ac-habano-resort-shirt',
    category: 'tops',
    price: '180000.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/884023/HOMBRE-CAMISA-95004088-HABANO-320_1.jpg?v=639125829935530000',
    imageAlt: 'Habano short sleeve resort shirt from Arturo Calle',
    imageDescription:
      'Habano short sleeve shirt with relaxed vacation styling, open collar, light drape, and warm neutral color.',
    colors: ['habano', 'tan'],
    sizes: shirtSizes,
    material: 'Linen blend',
    styleTags: ['shirt', 'resort', 'short-sleeve', 'warm-weather'],
  }),
  product({
    name: 'Blue Moda Shirt',
    slug: 'ac-blue-moda-shirt',
    category: 'tops',
    price: '139900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/836858/HOMBRE-CAMISA-35006077-AZUL-740_1.jpg?v=639041038711370000',
    imageAlt: 'Blue fashion shirt from Arturo Calle',
    imageDescription:
      'Blue long sleeve button-up shirt with classic collar, structured cuffs, and versatile smart-casual look.',
    colors: ['blue'],
    sizes: shirtSizes,
    material: 'Cotton blend',
    styleTags: ['shirt', 'blue', 'smart-casual', 'classic'],
  }),
  product({
    name: 'Navy Freedom Shirt',
    slug: 'ac-navy-freedom-shirt',
    category: 'tops',
    price: '159900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/853076/HOMBRE-CAMISA-35006103-AZUL-790_2.jpg?v=639070461891270000',
    imageAlt: 'Navy casual Freedom shirt from Arturo Calle',
    imageDescription:
      'Navy casual shirt with button front, long sleeves, soft collar, and relaxed everyday styling.',
    colors: ['navy'],
    sizes: shirtSizes,
    material: 'Cotton',
    styleTags: ['shirt', 'casual', 'navy', 'daily'],
  }),
  product({
    name: 'Wine Casual Shirt',
    slug: 'ac-wine-casual-shirt',
    category: 'tops',
    price: '159900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/869729/HOMBRE-CAMISA-35006088-VINO-490_1.jpg?v=639100861798600000',
    imageAlt: 'Wine color casual shirt from Arturo Calle',
    imageDescription:
      'Wine color button-up shirt with long sleeves, structured collar, and rich dark red tone for evening outfits.',
    colors: ['wine', 'burgundy'],
    sizes: shirtSizes,
    material: 'Cotton blend',
    styleTags: ['shirt', 'evening', 'wine', 'smart-casual'],
  }),
  product({
    name: 'Pattern Casual Shirt',
    slug: 'ac-pattern-casual-shirt',
    category: 'tops',
    price: '129900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/825286/HOMBRE-CAMISA-35006102-VARIOS_1.jpg?v=639015998083930000',
    imageAlt: 'Patterned casual shirt from Arturo Calle',
    imageDescription:
      'Patterned casual shirt with multicolor woven design, long sleeves, and classic button-up structure.',
    colors: ['multi'],
    sizes: shirtSizes,
    material: 'Cotton blend',
    styleTags: ['shirt', 'pattern', 'casual', 'statement'],
  }),
  product({
    name: 'Blue Business Shirt',
    slug: 'ac-blue-business-shirt',
    category: 'tops',
    price: '149900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/813692/HOMBRE-CAMISA-10148518-AZUL-760_1.jpg?v=638996850250670000',
    imageAlt: 'Blue business shirt from Arturo Calle',
    imageDescription:
      'Blue business shirt in sarga texture with long sleeves, formal collar, front buttons, and office-ready fit.',
    colors: ['blue'],
    sizes: shirtSizes,
    material: 'Cotton sarga',
    styleTags: ['shirt', 'business', 'blue', 'office'],
  }),
  product({
    name: 'Arena Linen Shirt',
    slug: 'ac-arena-linen-shirt',
    category: 'tops',
    price: '144990.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/877987/HOMBRE-CAMISA-10149143-ARENA-300_1.jpg?v=639115417703170000',
    imageAlt: 'Arena linen shirt from Arturo Calle',
    imageDescription:
      'Arena beige linen-blend shirt with semi slim fit, long sleeves, light texture, and relaxed warm-weather shape.',
    colors: ['arena', 'beige'],
    sizes: shirtSizes,
    material: 'Cotton linen blend',
    styleTags: ['shirt', 'linen', 'beige', 'warm-weather'],
  }),
  product({
    name: 'Cotton Business Shirt',
    slug: 'ac-cotton-business-shirt',
    category: 'tops',
    price: '149990.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/872426/HOMBRE-CAMISA-10153510-BLANCO-000_1.jpg?v=639111257396800000',
    imageAlt: 'White cotton business shirt from Arturo Calle',
    imageDescription:
      'White cotton business shirt with regular fit, clean collar, long sleeves, and crisp formal appearance.',
    colors: ['white'],
    sizes: shirtSizes,
    material: 'Cotton',
    styleTags: ['shirt', 'business', 'cotton', 'formal'],
  }),
  product({
    name: 'Lilac Linen Shirt',
    slug: 'ac-lilac-linen-shirt',
    category: 'tops',
    price: '189990.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/878007/HOMBRE-CAMISA-10149152-LILA-600_1.jpg?v=639115417725230000',
    imageAlt: 'Lilac linen blend shirt from Arturo Calle',
    imageDescription:
      'Lilac cotton-linen shirt with semi slim body, Amsterdam collar, long sleeves, and light summer texture.',
    colors: ['lilac'],
    sizes: shirtSizes,
    material: 'Cotton linen blend',
    styleTags: ['shirt', 'linen', 'lilac', 'smart-casual'],
  }),
  product({
    name: 'Habano Pants',
    slug: 'ac-habano-pants',
    category: 'bottoms',
    price: '174900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/834572/HOMBRE-PANTALON-35006108-HABANO-330_1.jpg?v=639034854762470000',
    imageAlt: 'Habano casual pants from Arturo Calle',
    imageDescription:
      'Habano straight pants with belt loops, front pockets, clean waistband, and casual tailored finish.',
    colors: ['habano', 'tan'],
    sizes: pantSizes,
    material: 'Cotton blend',
    styleTags: ['pants', 'casual', 'straight-leg', 'tan'],
  }),
  product({
    name: 'Blue Jeans',
    slug: 'ac-blue-jeans',
    category: 'bottoms',
    price: '179990.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/878381/HOMBRE-JEAN-10154660-AZUL-790_1.jpg?v=639115418245500000',
    imageAlt: 'Blue cotton jeans from Arturo Calle',
    imageDescription:
      'Blue denim jeans with five-pocket construction, belt loops, mid-rise waist, and classic straight shape.',
    colors: ['blue denim'],
    sizes: pantSizes,
    material: 'Cotton denim',
    styleTags: ['pants', 'jeans', 'denim', 'casual'],
  }),
  product({
    name: 'Regular Jeans',
    slug: 'ac-regular-jeans',
    category: 'bottoms',
    price: '179990.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/880702/HOMBRE-JEAN-10154664-AZUL-790_1.jpg?v=639120387535800000',
    imageAlt: 'Regular fit blue jeans from Arturo Calle',
    imageDescription:
      'Regular fit blue jeans with structured denim, straight leg, belt loops, and classic five-pocket styling.',
    colors: ['blue denim'],
    sizes: pantSizes,
    material: 'Cotton denim',
    styleTags: ['pants', 'jeans', 'regular-fit', 'casual'],
  }),
  product({
    name: 'High Rise Pants',
    slug: 'ac-high-rise-pants',
    category: 'bottoms',
    price: '179990.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/878496/HOMBRE-PANTALON-10154999-HABANO-330_1.jpg?v=639115418385570000',
    imageAlt: 'Habano high rise pants from Arturo Calle',
    imageDescription:
      'Habano high-rise trousers with regular fit, front closure, belt loops, and polished business-casual structure.',
    colors: ['habano'],
    sizes: pantSizes,
    material: 'Cotton blend',
    styleTags: ['pants', 'business', 'high-rise', 'tailored'],
  }),
  product({
    name: 'Cafe Business Pants',
    slug: 'ac-cafe-business-pants',
    category: 'bottoms',
    price: '169900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/853237/HOMBRE-PANTALON-10153344-CAFE-999_1.jpg?v=639070464959230000',
    imageAlt: 'Cafe business pants from Arturo Calle',
    imageDescription:
      'Dark cafe business trousers with regular fit, diagonal cotton texture, front pockets, and clean office shape.',
    colors: ['cafe', 'brown'],
    sizes: pantSizes,
    material: 'Cotton diagonal',
    styleTags: ['pants', 'business', 'brown', 'regular-fit'],
  }),
  product({
    name: 'Gray Slim Pants',
    slug: 'ac-gray-slim-pants',
    category: 'bottoms',
    price: '199900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/796231/HOMBRE-PANTALON-10150831-GRIS-080_1.jpg?v=638974627079100000',
    imageAlt: 'Gray slim business pants from Arturo Calle',
    imageDescription:
      'Gray slim fit business trousers with narrow leg, pressed shape, belt loops, and office-ready finish.',
    colors: ['gray'],
    sizes: pantSizes,
    material: 'Cotton blend',
    styleTags: ['pants', 'business', 'slim-fit', 'gray'],
  }),
  product({
    name: 'Green Business Pants',
    slug: 'ac-green-business-pants',
    category: 'bottoms',
    price: '199900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/794342/HOMBRE-PANTALON-10150830-VERDE-899_1.jpg?v=638968439280430000',
    imageAlt: 'Green regular business pants from Arturo Calle',
    imageDescription:
      'Dark green regular fit trousers with business styling, clean waistband, straight leg, and cotton texture.',
    colors: ['green'],
    sizes: pantSizes,
    material: 'Cotton',
    styleTags: ['pants', 'business', 'green', 'regular-fit'],
  }),
  product({
    name: 'Wine Slim Pants',
    slug: 'ac-wine-slim-pants',
    category: 'bottoms',
    price: '149925.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/751241/HOMBRE-PANTALON-10146095-VINO-499_1.jpg?v=638858810286630000',
    imageAlt: 'Wine slim business pants from Arturo Calle',
    imageDescription:
      'Wine slim fit trousers with business waistband, front pockets, tapered leg, and deep burgundy tone.',
    colors: ['wine'],
    sizes: pantSizes,
    material: 'Cotton blend',
    styleTags: ['pants', 'business', 'slim-fit', 'wine'],
  }),
  product({
    name: 'Navy Slim Pants',
    slug: 'ac-navy-slim-pants',
    category: 'bottoms',
    price: '169900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/720178/HOMBRE-PANTALON-10145162-AZUL-799_1.jpg?v=638811035575830000',
    imageAlt: 'Navy slim business pants from Arturo Calle',
    imageDescription:
      'Navy slim business pants with tapered leg, smooth front, belt loops, and formal dark blue color.',
    colors: ['navy'],
    sizes: pantSizes,
    material: 'Cotton blend',
    styleTags: ['pants', 'business', 'navy', 'slim-fit'],
  }),
  product({
    name: 'Olive Casual Pants',
    slug: 'ac-olive-casual-pants',
    category: 'bottoms',
    price: '169900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/742537/HOMBRE-PANTALON-10141273-VERDE-890_1.jpg?v=638847523319970000',
    imageAlt: 'Olive casual pants from Arturo Calle',
    imageDescription:
      'Olive regular fit casual pants with cotton diagonal fabric, belt loops, straight leg, and utility-neutral color.',
    colors: ['olive', 'green'],
    sizes: pantSizes,
    material: 'Cotton diagonal',
    styleTags: ['pants', 'casual', 'olive', 'regular-fit'],
  }),
  product({
    name: 'Navy Casual Pants',
    slug: 'ac-navy-casual-pants',
    category: 'bottoms',
    price: '199990.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/863372/HOMBRE-PANTALON-10152791-AZUL-799_1.jpg?v=639088670788200000',
    imageAlt: 'Navy casual pants from Arturo Calle',
    imageDescription:
      'Navy regular fit casual trousers with organic cotton look, straight leg, and clean everyday construction.',
    colors: ['navy'],
    sizes: pantSizes,
    material: 'Organic cotton blend',
    styleTags: ['pants', 'casual', 'navy', 'organic-cotton'],
  }),
  product({
    name: 'Linen Pants',
    slug: 'ac-linen-pants',
    category: 'bottoms',
    price: '204900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/829476/HOMBRE-PANTALON-10147329-CAFE-920_1.jpg?v=639023700190430000',
    imageAlt: 'Cafe linen pants from Arturo Calle',
    imageDescription:
      'Cafe linen trousers with semi slim leg, light woven texture, belt loops, and relaxed summer tailoring.',
    colors: ['cafe'],
    sizes: pantSizes,
    material: 'Linen blend',
    styleTags: ['pants', 'linen', 'warm-weather', 'semi-slim'],
  }),
  product({
    name: 'White Women Pants',
    slug: 'ac-white-women-pants',
    category: 'bottoms',
    price: '149900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/851978/MUJER-PANTALON-10151850-BLANCO-000_1.jpg?v=639070456396370000',
    imageAlt: 'White women pants from Arturo Calle',
    imageDescription:
      'White women trousers with flat front, smooth waistband, light tafeta-like fabric, and polished straight shape.',
    colors: ['white'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    material: 'Cotton tafeta blend',
    styleTags: ['pants', 'women', 'white', 'minimal'],
  }),
  product({
    name: 'Navy Microfiber Jacket',
    slug: 'ac-navy-microfiber-jacket',
    category: 'outerwear',
    price: '269900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/801684/HOMBRE-CHAQUETA-10148259-AZUL-790_1.jpg?v=638985843861630000',
    imageAlt: 'Navy microfiber jacket from Arturo Calle',
    imageDescription:
      'Navy microfiber jacket with sport collar, zip front, long sleeves, and lightweight clean outerwear shape.',
    colors: ['navy'],
    sizes: jacketSizes,
    material: 'Microfiber polyester',
    styleTags: ['jacket', 'navy', 'lightweight', 'sport'],
  }),
  product({
    name: 'Navy Bomber Jacket',
    slug: 'ac-navy-bomber-jacket',
    category: 'outerwear',
    price: '289900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/850146/HOMBRE-CHAQUETA-10143735-AZUL-790_1.jpg?v=639069547654430000',
    imageAlt: 'Navy bomber jacket from Arturo Calle',
    imageDescription:
      'Navy bomber-style jacket with padded body, ribbed collar and cuffs, zip closure, and casual structured silhouette.',
    colors: ['navy'],
    sizes: jacketSizes,
    material: 'Polyester knit blend',
    styleTags: ['jacket', 'bomber', 'padded', 'casual'],
  }),
  product({
    name: 'Black Rib Jacket',
    slug: 'ac-black-rib-jacket',
    category: 'outerwear',
    price: '299990.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/884750/HOMBRE-CHAQUETA-10152390-NEGRO-090_1.jpg?v=639127459543570000',
    imageAlt: 'Black rib collar jacket from Arturo Calle',
    imageDescription:
      'Black jacket with rib collar, zip front, long sleeves, smooth woven panels, and minimal urban look.',
    colors: ['black'],
    sizes: jacketSizes,
    material: 'Polyester knit blend',
    styleTags: ['jacket', 'black', 'rib-collar', 'minimal'],
  }),
  product({
    name: 'Navy Padded Jacket',
    slug: 'ac-navy-padded-jacket',
    category: 'outerwear',
    price: '279900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/842452/HOMBRE-CHAQUETA-10150600-AZUL-790_1.jpg?v=639057580586270000',
    imageAlt: 'Navy padded high collar jacket from Arturo Calle',
    imageDescription:
      'Navy padded jacket with high collar, snap details, zip front, and warm quilted body.',
    colors: ['navy'],
    sizes: jacketSizes,
    material: 'Polyester',
    styleTags: ['jacket', 'padded', 'winter', 'navy'],
  }),
  product({
    name: 'Brown Padded Jacket',
    slug: 'ac-brown-padded-jacket',
    category: 'outerwear',
    price: '239900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/785599/HOMBRE-CHAQUETA-10146471-CAFE-950_1.jpg?v=638937240264770000',
    imageAlt: 'Brown padded high collar jacket from Arturo Calle',
    imageDescription:
      'Brown high collar padded jacket with quilted panels, front zipper, and warm casual outerwear shape.',
    colors: ['brown', 'cafe'],
    sizes: jacketSizes,
    material: 'Polyester',
    styleTags: ['jacket', 'padded', 'brown', 'casual'],
  }),
  product({
    name: 'Black Leather Jacket',
    slug: 'ac-black-leather-jacket',
    category: 'outerwear',
    price: '899900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/836183/HOMBRE-CHAQUETA-10138591-NEGRO-090_1.jpg?v=639039301971530000',
    imageAlt: 'Black leather jacket from Arturo Calle',
    imageDescription:
      'Black lamb leather jacket with high collar, zip front, smooth leather panels, and fitted masculine silhouette.',
    colors: ['black'],
    sizes: jacketSizes,
    material: 'Lamb leather',
    styleTags: ['jacket', 'leather', 'black', 'evening'],
  }),
  product({
    name: 'Green Rib Jacket',
    slug: 'ac-green-rib-jacket',
    category: 'outerwear',
    price: '239900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/879847/HOMBRE-CHAQUETA-10152648-VERDE-890_1.jpg?v=639120386044270000',
    imageAlt: 'Green rib collar jacket from Arturo Calle',
    imageDescription:
      'Green jacket with ribbed collar and cuffs, zip closure, clean front, and casual lightweight fit.',
    colors: ['green'],
    sizes: jacketSizes,
    material: 'Polyester',
    styleTags: ['jacket', 'green', 'rib-collar', 'casual'],
  }),
  product({
    name: 'Blue Overcoat',
    slug: 'ac-blue-overcoat',
    category: 'outerwear',
    price: '469990.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/884869/HOMBRE-ABRIGO-10153343-AZUL-780_1.jpg?v=639127459699770000',
    imageAlt: 'Blue overcoat from Arturo Calle',
    imageDescription:
      'Blue semi slim overcoat with long tailored body, lapels, center back opening, and refined sarga texture.',
    colors: ['blue'],
    sizes: jacketSizes,
    material: 'Sarga wool blend',
    styleTags: ['coat', 'overcoat', 'business', 'blue'],
  }),
  product({
    name: 'Gray Overcoat',
    slug: 'ac-gray-overcoat',
    category: 'outerwear',
    price: '449900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/862489/HOMBRE-ABRIGO-10149309-GRIS-030_1.jpg?v=639088669659230000',
    imageAlt: 'Gray overcoat from Arturo Calle',
    imageDescription:
      'Gray structured overcoat with semi slim fit, long sleeves, lapel front, and polished winter tailoring.',
    colors: ['gray'],
    sizes: jacketSizes,
    material: 'Wool blend',
    styleTags: ['coat', 'overcoat', 'gray', 'formal'],
  }),
  product({
    name: 'Navy Trench Coat',
    slug: 'ac-navy-trench-coat',
    category: 'outerwear',
    price: '549990.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/869020/HOMBRE-ABRIGO-10148484-AZUL-799_1.jpg?v=639100860673300000',
    imageAlt: 'Navy trench coat from Arturo Calle',
    imageDescription:
      'Navy water-repellent trench coat with long body, lapels, button front, and clean structured raincoat look.',
    colors: ['navy'],
    sizes: jacketSizes,
    material: 'Water-repellent polyester blend',
    styleTags: ['coat', 'trench', 'rain', 'business'],
  }),
  product({
    name: 'Black Overcoat',
    slug: 'ac-black-overcoat',
    category: 'outerwear',
    price: '449900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/794732/HOMBRE-ABRIGO-10149819-NEGRO-090_1.jpg?v=638970034205430000',
    imageAlt: 'Black overcoat from Arturo Calle',
    imageDescription:
      'Black structured overcoat with five-button front, long tailored cut, clean lapels, and formal winter silhouette.',
    colors: ['black'],
    sizes: jacketSizes,
    material: 'Wool blend',
    styleTags: ['coat', 'black', 'formal', 'winter'],
  }),
  product({
    name: 'Black Wool Blazer',
    slug: 'ac-black-wool-blazer',
    category: 'outerwear',
    price: '769990.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/858979/HOMBRE-BLAZER-10152200-NEGRO-090_1.jpg?v=639082455945670000',
    imageAlt: 'Black formal wool blazer from Arturo Calle',
    imageDescription:
      'Black formal wool blazer with lapels, structured shoulder, button front, and European tailored fit.',
    colors: ['black'],
    sizes: jacketSizes,
    material: 'Wool',
    styleTags: ['blazer', 'formal', 'black', 'business'],
  }),
  product({
    name: 'Navy Business Blazer',
    slug: 'ac-navy-business-blazer',
    category: 'outerwear',
    price: '369900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/854551/HOMBRE-BLAZER-10151209-AZUL-790_2.jpg?v=639072194127170000',
    imageAlt: 'Navy business blazer from Arturo Calle',
    imageDescription:
      'Navy business blazer with structured shoulders, lapel front, tailored body, and polished office styling.',
    colors: ['navy'],
    sizes: jacketSizes,
    material: 'Wool blend',
    styleTags: ['blazer', 'business', 'navy', 'tailored'],
  }),
  product({
    name: 'Kids Denim Jacket',
    slug: 'offcorss-kids-denim-jacket',
    category: 'outerwear',
    price: '79995.00',
    imageUrl:
      'https://offcorss.vteximg.com.br/arquivos/ids/939297/42171001-Indigo-Medio_10.jpg.jpg?v=638893994838400000',
    imageAlt: 'Kids denim jacket from OFFCORSS',
    imageDescription:
      'Kids medium indigo denim jacket with front buttons, patch pockets, collar, and casual structured denim shape.',
    colors: ['indigo'],
    sizes: kidsSizes,
    material: 'Cotton denim',
    styleTags: ['jacket', 'kids', 'denim', 'casual'],
  }),
  product({
    name: 'Kids Blazer',
    slug: 'offcorss-kids-blazer',
    category: 'outerwear',
    price: '58096.00',
    imageUrl:
      'https://offcorss.vteximg.com.br/arquivos/ids/838564/41530921-Azul-19-3921_10.jpg?v=638452595204930000',
    imageAlt: 'Kids blue blazer from OFFCORSS',
    imageDescription:
      'Kids blue blazer with lapels, long sleeves, button front, and dressy special-occasion tailoring.',
    colors: ['blue'],
    sizes: kidsSizes,
    material: 'Cotton',
    styleTags: ['blazer', 'kids', 'formal', 'blue'],
  }),
  product({
    name: 'Kids Beige Pants',
    slug: 'offcorss-kids-beige-pants',
    category: 'bottoms',
    price: '62995.00',
    imageUrl:
      'https://offcorss.vteximg.com.br/arquivos/ids/836645/52270621-Beige-13-1009_10.jpg?v=638446494154400000',
    imageAlt: 'Kids beige pants from OFFCORSS',
    imageDescription:
      'Kids beige pants with straight leg, soft waistband, front pockets, and easy casual fit.',
    colors: ['beige'],
    sizes: kidsSizes,
    material: 'Cotton blend',
    styleTags: ['pants', 'kids', 'beige', 'casual'],
  }),
  product({
    name: 'Kids White Shirt',
    slug: 'offcorss-kids-white-shirt',
    category: 'tops',
    price: '62995.00',
    imageUrl:
      'https://offcorss.vteximg.com.br/arquivos/ids/835980/51049241-Blanco-10-0000_10.jpg?v=638446483289930000',
    imageAlt: 'Kids white long sleeve shirt from OFFCORSS',
    imageDescription:
      'Kids white long sleeve shirt with pointed collar, front buttons, and classic dress-shirt structure.',
    colors: ['white'],
    sizes: kidsSizes,
    material: 'Cotton',
    styleTags: ['shirt', 'kids', 'white', 'formal'],
  }),
  product({
    name: 'Black Leather Belt',
    slug: 'ac-black-leather-belt',
    category: 'accessories',
    price: '99900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/689654/HOMBRE-CORREA-10138942-NEGRO-090_1.jpg?v=638743999246500000',
    imageAlt: 'Black leather belt from Arturo Calle',
    imageDescription:
      'Black leather belt with rectangular metal buckle, smooth strap, and formal accessory proportions.',
    colors: ['black'],
    sizes: ['S', 'M', 'L', 'XL'],
    material: 'Leather and zamac buckle',
    styleTags: ['belt', 'accessory', 'formal', 'black'],
  }),
  product({
    name: 'Brown Leather Belt',
    slug: 'ac-brown-leather-belt',
    category: 'accessories',
    price: '89900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/830359/HOMBRE-CORREA-10151814-CAFE-970_1.jpg?v=639023703170970000',
    imageAlt: 'Brown leather belt from Arturo Calle',
    imageDescription:
      'Brown leather belt with metal buckle, smooth strap, and casual-formal styling for trousers.',
    colors: ['brown'],
    sizes: ['S', 'M', 'L', 'XL'],
    material: 'Leather',
    styleTags: ['belt', 'accessory', 'brown', 'casual'],
  }),
  product({
    name: 'Tan Leather Bag',
    slug: 'ac-tan-leather-bag',
    category: 'accessories',
    price: '219900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/879665/MUJER-BOLSO-10152385-HABANO-340_1.jpg?v=639120385819500000',
    imageAlt: 'Tan leather bag from Arturo Calle',
    imageDescription:
      'Tan leather handbag with structured body, top handle, smooth leather texture, and polished everyday shape.',
    colors: ['tan', 'habano'],
    sizes: ['One Size'],
    material: 'Leather',
    styleTags: ['bag', 'accessory', 'tan', 'structured'],
  }),
  product({
    name: 'Black Leather Bag',
    slug: 'ac-black-leather-bag',
    category: 'accessories',
    price: '229900.00',
    imageUrl:
      'https://arturocalle.vteximg.com.br/arquivos/ids/882146/MUJER-BOLSO-10153612-NEGRO-090_1.jpg?v=639123064752870000',
    imageAlt: 'Black leather bag from Arturo Calle',
    imageDescription:
      'Black leather handbag with structured silhouette, top handles, dark smooth finish, and refined accessory styling.',
    colors: ['black'],
    sizes: ['One Size'],
    material: 'Leather',
    styleTags: ['bag', 'accessory', 'black', 'business'],
  }),
]

export const site = {
  name: 'Cervan',
  seoName: 'Cervan Lojistik',
  alternateNames: ['Cervan', 'Cervan Logistik'],
  url: 'https://cervanlojistik.com',
  description:
    'Cervan Lojistik; Ankara merkezli olarak Türkiye genelinde mobilya depolama, montaj, demontaj, paketleme ve nakliye hizmetleri sunar.',
  location: 'Ankara',
  serviceArea: 'Türkiye geneli',
  contact: {
    // Yayına çıkmadan önce bu alanları gerçek bilgilerle güncelleyin.
    phone: '',
    email: '',
    address: '',
    whatsapp: '',
  },
} as const;

export const services = [
  {
    number: '01',
    title: 'Mobilya Depolama',
    description:
      'Üretimden çıkan veya sevkiyat planını bekleyen mobilyalarınızı; ürün, proje ve teslimat sırasına göre düzenli biçimde depoluyoruz. Ürünlerinizi dağıtıma hazır, kontrollü ve operasyon akışınıza uygun şekilde muhafaza ediyoruz.',
  },
  {
    number: '02',
    title: 'Mobilya Montajı',
    description:
      'Üretici standartlarını koruyarak mağaza, ofis, konut ve proje sahalarında profesyonel montaj hizmeti sunuyoruz. Ürünlerin doğru, eksiksiz ve kullanıma hazır teslim edilmesi için tüm kurulumu deneyimli ekibimizle yönetiyoruz.',
  },
  {
    number: '03',
    title: 'Demontaj & Paketleme',
    description:
      'Teşhir, transfer, iade veya yeniden kurulum süreçlerinde mobilyaları ürüne zarar vermeden demonte ediyoruz. Parçaları yüzey ve donanım özelliklerine uygun malzemelerle paketleyerek taşıma ve depolama için güvenli hale getiriyoruz.',
  },
] as const;

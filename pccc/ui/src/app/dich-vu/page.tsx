'use client';

import Navigation from '@/components/Navigation';

interface ServicePackage {
  id: string;
  name: string;
  price: string;
  duration: string;
  features: string[];
  popular?: boolean;
  color: string;
}

const packages: ServicePackage[] = [
  {
    id: 'basic',
    name: 'Gói Cơ Bản',
    price: '5.000.000đ',
    duration: 'Một lần',
    color: 'blue',
    features: [
      'Tư vấn thiết kế hệ thống PCCC',
      'Lập hồ sơ thiết kế cơ bản',
      'Hướng dẫn lắp đặt thiết bị',
      'Hỗ trợ qua điện thoại',
      'Thời gian hoàn thành: 7-10 ngày'
    ]
  },
  {
    id: 'standard',
    name: 'Gói Tiêu Chuẩn',
    price: '12.000.000đ',
    duration: 'Một lần',
    color: 'red',
    popular: true,
    features: [
      'Tất cả tính năng Gói Cơ Bản',
      'Khảo sát thực địa',
      'Lập hồ sơ thiết kế chi tiết',
      'Thẩm duyệt PCCC',
      'Giám sát thi công',
      'Hỗ trợ nghiệm thu',
      'Thời gian hoàn thành: 15-20 ngày'
    ]
  },
  {
    id: 'premium',
    name: 'Gói Cao Cấp',
    price: '25.000.000đ',
    duration: 'Một lần',
    color: 'orange',
    features: [
      'Tất cả tính năng Gói Tiêu Chuẩn',
      'Thiết kế hệ thống báo cháy tự động',
      'Thiết kế hệ thống chữa cháy tự động',
      'Lập phương án chữa cháy',
      'Đào tạo nhân viên PCCC',
      'Nghiệm thu PCCC',
      'Bảo hành 12 tháng',
      'Thời gian hoàn thành: 20-30 ngày'
    ]
  },
  {
    id: 'enterprise',
    name: 'Gói Doanh Nghiệp',
    price: 'Liên hệ',
    duration: 'Theo dự án',
    color: 'purple',
    features: [
      'Tất cả tính năng Gói Cao Cấp',
      'Tư vấn toàn diện cho dự án lớn',
      'Thiết kế hệ thống phức tạp',
      'Quản lý dự án chuyên nghiệp',
      'Đội ngũ kỹ sư chuyên trách',
      'Bảo trì định kỳ 24 tháng',
      'Hỗ trợ khẩn cấp 24/7',
      'Ưu tiên xử lý'
    ]
  }
];

const additionalServices = [
  {
    icon: '📋',
    title: 'Kiểm định PCCC',
    description: 'Kiểm tra, đánh giá hệ thống PCCC hiện có',
    price: 'Từ 3.000.000đ'
  },
  {
    icon: '🎓',
    title: 'Đào tạo PCCC',
    description: 'Đào tạo nghiệp vụ PCCC cho nhân viên',
    price: 'Từ 2.000.000đ/khóa'
  },
  {
    icon: '🔧',
    title: 'Bảo trì hệ thống',
    description: 'Bảo trì, bảo dưỡng định kỳ hệ thống PCCC',
    price: 'Từ 1.500.000đ/lần'
  },
  {
    icon: '📝',
    title: 'Tư vấn pháp lý',
    description: 'Tư vấn về quy định, thủ tục PCCC',
    price: 'Từ 1.000.000đ/buổi'
  }
];

export default function ServicePage() {
  const getColorClasses = (color: string, type: 'bg' | 'border' | 'text' | 'gradient') => {
    const colors = {
      blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-600',
        gradient: 'from-blue-500 to-cyan-500'
      },
      red: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-600',
        gradient: 'from-red-500 to-orange-500'
      },
      orange: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-600',
        gradient: 'from-orange-500 to-yellow-500'
      },
      purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-600',
        gradient: 'from-purple-500 to-pink-500'
      }
    };
    return colors[color as keyof typeof colors]?.[type] || colors.blue[type];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
      {/* Navigation */}
      <Navigation />

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-full mb-6">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span className="font-semibold">Dịch Vụ Chuyên Nghiệp</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
          Gói Dịch Vụ PCCC
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Lựa chọn gói dịch vụ phù hợp với nhu cầu của bạn. Chúng tôi cung cấp giải pháp toàn diện từ tư vấn, thiết kế đến nghiệm thu PCCC.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden ${
                pkg.popular ? 'ring-2 ring-red-500 scale-105' : ''
              }`}
            >
              {pkg.popular && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-1 text-sm font-bold rounded-bl-lg">
                  PHỔ BIẾN
                </div>
              )}
              
              <div className={`p-6 ${getColorClasses(pkg.color, 'bg')} border-b ${getColorClasses(pkg.color, 'border')}`}>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-bold ${getColorClasses(pkg.color, 'text')}`}>
                    {pkg.price}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{pkg.duration}</p>
              </div>

              <div className="p-6">
                <ul className="space-y-3 mb-6">
                  {pkg.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <svg className={`w-5 h-5 ${getColorClasses(pkg.color, 'text')} flex-shrink-0 mt-0.5`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className={`w-full py-3 rounded-lg font-semibold text-white bg-gradient-to-r ${getColorClasses(pkg.color, 'gradient')} hover:shadow-lg transition-all duration-300 hover:scale-105`}
                >
                  Chọn gói này
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Services */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Dịch Vụ Bổ Sung</h2>
          <p className="text-lg text-gray-600">Các dịch vụ khác để hỗ trợ bạn toàn diện</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {additionalServices.map((service, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-4xl mb-4">{service.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{service.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{service.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-red-600 font-bold">{service.price}</span>
                <button className="text-red-600 hover:text-red-700 font-medium text-sm">
                  Chi tiết →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-12 text-center text-white shadow-2xl">
          <h2 className="text-4xl font-bold mb-4">Chưa chắc chắn gói nào phù hợp?</h2>
          <p className="text-xl mb-8 opacity-90">
            Liên hệ với chúng tôi để được tư vấn miễn phí và báo giá chi tiết
          </p>
          <div className="flex items-center justify-center gap-4">
            <button className="px-8 py-4 bg-white text-red-600 rounded-lg font-bold hover:bg-gray-100 transition-all duration-300 hover:scale-105">
              Tư vấn miễn phí
            </button>
            <button className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg font-bold hover:bg-white/10 transition-all duration-300">
              Gọi: 1900-xxxx
            </button>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-4xl font-bold text-gray-900 text-center mb-12">Câu Hỏi Thường Gặp</h2>
        <div className="space-y-4">
          {[
            {
              q: 'Thời gian hoàn thành dự án là bao lâu?',
              a: 'Tùy thuộc vào gói dịch vụ và quy mô dự án, thời gian hoàn thành từ 7-30 ngày. Chúng tôi cam kết đúng tiến độ đã thỏa thuận.'
            },
            {
              q: 'Có hỗ trợ sau khi hoàn thành không?',
              a: 'Có, tất cả các gói đều có hỗ trợ sau bán hàng. Gói Cao Cấp và Doanh Nghiệp có bảo hành và bảo trì định kỳ.'
            },
            {
              q: 'Thanh toán như thế nào?',
              a: 'Thanh toán theo tiến độ: 40% khi ký hợp đồng, 40% khi hoàn thành thiết kế, 20% khi nghiệm thu.'
            },
            {
              q: 'Có thể tùy chỉnh gói dịch vụ không?',
              a: 'Có, chúng tôi linh hoạt tùy chỉnh gói dịch vụ theo nhu cầu cụ thể của bạn. Liên hệ để được tư vấn chi tiết.'
            }
          ].map((faq, idx) => (
            <details
              key={idx}
              className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-all duration-300"
            >
              <summary className="font-bold text-gray-900 text-lg">
                {faq.q}
              </summary>
              <p className="mt-4 text-gray-600">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}


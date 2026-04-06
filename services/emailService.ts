import emailjs from '@emailjs/browser';

export const sendRegistrationEmail = async (userData: any) => {
  try {
    const response = await emailjs.send(
      'service_2bhrbcn', 
      'template_xysm7er', 
      {
        first_name: userData.firstName,
        last_name: userData.lastName,
        user_email: userData.email,
        phone: userData.phone || 'Not provided',
        gender: userData.gender,
        birth_date: userData.birthDate,
        business_name: "MaxBit LLC",
      },
      'ewqLULf0b6_PZy8W5'
    );
    return response;
  } catch (error) {
    console.error("Email error:", error);
    throw error;
  }
};
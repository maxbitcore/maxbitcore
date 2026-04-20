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

export const sendBuildRequestEmail = async (buildData: any) => {
  try {
    const response = await emailjs.send(
      'service_2bhrbcn', 
      'template_pu8w48z', 
      {
        protocol_id: buildData.id,
        user_name: buildData.userName,
        user_email: buildData.userEmail,
        budget: buildData.budget,
        deadline: buildData.deadline,
        purpose: buildData.purpose,
  
        hardware_summary: `
          CPU Brand: ${buildData.cpu}
          GPU: ${buildData.gpu} (${buildData.manufacturer})
          Storage: ${buildData.ssd}
          Case: ${buildData.caseSize} / ${buildData.caseType}
          Aesthetic: ${buildData.aesthetic}
          Resolution: ${buildData.resolution}
        `,
        requirements: buildData.requirements || 'No specific requirements',
        timestamp: new Date(buildData.timestamp).toLocaleString(),
      },
      'ewqLULf0b6_PZy8W5' 
    );
    return response;
  } catch (error) {
    console.error("Build Request Email error:", error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email: string, resetLink: string) => {
  try {
    const response = await emailjs.send(
      'service_2bhrbcn', 
      'template_build_req', 
      {
        user_email: email,
        reset_link: resetLink, // Ссылка на страницу, где юзер введет новый пароль
        business_name: "MaxBit LLC",
        support_email: "support@maxbitcore.com"
      },
      'ewqLULf0b6_PZy8W5'
    );
    return response;
  } catch (error) {
    console.error("Reset Password Email error:", error);
    throw error;
  }
};
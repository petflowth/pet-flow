import type { MessagesConfig } from "./config-types";

/**
 * ข้อความ "ยอมรับโดยปริยาย" — แสดงตายตัวบนการ์ดเงื่อนไข/การ์ดเตรียมตัวก่อนเข้าพัก และในหน้ายอมรับข้อตกลง
 * (ไม่อยู่ในรายการข้อตกลงที่แก้ได้ในตั้งค่า เพื่อให้ขึ้นทุกครั้งเสมอ)
 */
export const DEEMED_CONSENT_NOTICE =
  "หากท่านไม่ได้ตอบกลับ ไม่ได้แนบเอกสาร หรือไม่ได้กดยอมรับข้อตกลงภายในวันเข้าพัก แต่ยังนำน้องเข้าพักตามนัด " +
  "ทางร้านถือว่าท่านได้รับข้อความนี้แล้ว และรับทราบและยอมรับข้อตกลงและเงื่อนไขการเข้าพักทั้งหมด นับตั้งแต่วันที่ได้รับข้อความนี้ " +
  "ข้อความนี้มีผลผูกพันและใช้เป็นหลักฐานการตกลงระหว่างท่านกับทางร้านได้ตามกฎหมาย";

/** ข้อตกลงโดยปริยาย ฉบับนัดอาบน้ำ */
export const DEEMED_GROOM_CONSENT_NOTICE =
  "หากท่านไม่ได้ตอบกลับหรือกดยอมรับข้อตกลงภายในวันนัดอาบน้ำ และยังนำน้องมารับบริการตามนัด " +
  "ทางร้านถือว่าท่านได้รับทราบและยอมรับข้อตกลงและเงื่อนไขการใช้บริการอาบน้ำทั้งหมดแล้ว นับตั้งแต่วันที่ได้รับข้อความนี้ " +
  "และข้อความนี้ใช้เป็นหลักฐานการตกลงระหว่างท่านกับทางร้านได้ตามกฎหมาย";

export const DEEMED_CONSENT_NOTICE_EN =
  "If you do not reply, attach documents or accept the terms by your check-in date but still bring your pet for the stay, " +
  "the shop will consider that you have received this message and acknowledge and accept all terms and conditions of the stay from the date you received it. " +
  "This message is binding and may be used as legal evidence of the agreement between you and the shop.";

export const DEEMED_GROOM_CONSENT_NOTICE_EN =
  "If you do not reply or accept the terms by your grooming date but still bring your pet to the appointment, " +
  "the shop will consider that you acknowledge and accept all grooming terms and conditions from the date you received this message, " +
  "and this message may be used as legal evidence of the agreement between you and the shop.";

export const GROOM_CONSENT_CONFIRM_EN =
  "I confirm that I have read, understood and accept all service terms, " +
  "and that I have given true information about my pet's health and behaviour.";

/** คำยืนยันท้ายหน้ากดยอมรับข้อตกลงอาบน้ำ */
export const GROOM_CONSENT_CONFIRM =
  "ข้าพเจ้ายืนยันว่าได้อ่าน เข้าใจ และยอมรับเงื่อนไขการใช้บริการทั้งหมด " +
  "รวมถึงได้แจ้งข้อมูลสุขภาพและพฤติกรรมของน้องตามความเป็นจริง";

/** ค่าเริ่มต้นของข้อความหาลูกค้า (แก้ได้ในหน้าตั้งค่า > ข้อความ) */
export const DEFAULT_MESSAGES: MessagesConfig = {
  depositReminder:
    "🏠 {shop}\n" +
    "ใกล้ถึงวันเข้าพักของ{pet}แล้วนะคะ ({checkin})\n\n" +
    "มัดจำที่ชำระแล้ว: {deposit} บาท\n" +
    "ยอดคงเหลือที่ต้องโอนก่อนเข้าพัก: {remaining} บาท\n\n" +
    "{bank}\nเลขบัญชี: {accountNumber}\nชื่อบัญชี: {accountName}\n\n" +
    "โอนแล้วแจ้งสลิปได้เลยนะคะ 🧡",
  prestayReminder:
    "🏠 {shop}\n" +
    "ใกล้ถึงวันเข้าพักของ{pet}แล้วนะคะ 🐾\n\n" +
    "📅 เข้าพัก: {checkin} {checkout}\n{room}\n\n" +
    "📋 เตรียมตัวก่อนเข้าพัก:\n" +
    "• หยดยาป้องกันเห็บหมัด/ปรสิตให้น้องก่อนมา\n" +
    "• เตรียมอาหารที่น้องกินประจำ (ระบุมื้อ/ปริมาณ)\n" +
    "• แจ้งประวัติการดูแล นิสัย และโรคประจำตัวของน้อง\n" +
    "{litterNote}\n" +
    "มีข้อสงสัยทักแชทได้เลยนะคะ 🧡",
  prestayIntro: "ใกล้ถึงวันเข้าพักของ{pet}แล้วน้า 🐾🧡",
  prestayPrepIntro:
    "เพื่อให้น้องเข้าพักได้อย่างสบายใจ รบกวนเตรียมสิ่งเหล่านี้มาด้วยนะคะ 🧳",
  prestayPrepItems: [
    "💊 ยาที่น้องทานเป็นประจำ (ถ้ามี)",
    "🍽️ อาหารของน้อง พร้อมแจ้งปริมาณต่อมื้อ",
    "📖 สมุดวัคซีน หรือรูปใบรับรองวัคซีน",
    "🧸 ของเล่นหรือของใช้ส่วนตัวที่มีกลิ่นน้องหรือผู้ปกครอง จะช่วยให้น้องปรับตัวง่ายขึ้นค่ะ",
  ],
  prestayCareNote:
    "💌 หากน้องมีนิสัย ความชอบ หรือมีเรื่องที่อยากให้เราดูแลเป็นพิเศษ แจ้งเราได้เลยนะคะ เราอยากให้น้องรู้สึกสบายที่สุดตลอดการเข้าพัก 🧡",
  prestayLitterNote:
    "⭐ สำหรับการเข้าพักไม่เกิน {min} คืน รบกวนเตรียมทรายของน้องมาด้วยนะคะ เพื่อให้น้องคุ้นเคยและปรับตัวได้ไวขึ้นค่ะ",
  checkinReminder:
    "🏠 {shop}\n" +
    "ใกล้ถึงวันเข้าพักของ{pet}แล้วน้า 🐾🧡\n\n" +
    "🧡 แจ้งเวลาเข้าพักของน้องได้เลยนะคะ เราจะได้เตรียมห้องและรอต้อนรับน้องให้พร้อมค่ะ 🐾\n\n" +
    "📅 วันเข้าพัก: {checkin}\n{room}\n\n" +
    "🕒 กดปุ่มด้านล่างเพื่อเลือกเวลาที่จะมาส่งน้อง (9:00–19:00 หรือกรอกเวลาเอง)",
  checkoutReminder:
    "🏠 {shop}\n" +
    "พรุ่งนี้ได้เจอ{pet}แล้วนะคะ 🐾🧡\n\n" +
    "📅 วันรับน้อง: {checkout}\n\n" +
    "🕒 กดปุ่มด้านล่างเพื่อเลือกเวลาที่จะมารับน้อง เราจะได้เตรียมน้องให้พร้อมก่อนกลับบ้าน 🧡\n" +
    "(9:00–19:00 หรือกรอกเวลาเอง)",
  reviewRequest:
    "🧡 {shop}\n" +
    "หวังว่า{pet}จะมีความสุขกับการเข้าพักนะคะ 🐾\n\n" +
    "ถ้าประทับใจ รบกวนรีวิวให้กำลังใจเราสักนิดได้ไหมคะ 🥺 มีความหมายกับเรามากๆ เลยค่ะ ขอบคุณที่ไว้ใจให้เราดูแลน้องนะคะ 💛",
  groomInfoIntro:
    "ใกล้ถึงวันอาบน้ำของ{pet}แล้วนะคะ 🛁🐾\n\n" +
    "เพราะเราเป็นห่วงและอยากให้น้องปลอดภัย สบายใจที่สุดตอนอยู่กับเรา 🧡 " +
    "รบกวนแจ้งประวัติน้องสั้นๆ (กดเลือกเอา ไม่ต้องพิมพ์เยอะ) เพื่อให้เราเตรียมดูแลน้องได้ถูกวิธีนะคะ 🐾",
  consentInvite:
    "📋 กรุณาอ่านและกดยอมรับข้อตกลงก่อนเข้าพักของ{pet}ที่นี่นะคะ 🧡\n{url}",
  depositRequestTitle: "🧡 ล็อกคิวให้น้องกันค่ะ",
  depositRequestBody:
    "เพื่อให้เราจัดคิวและเตรียมห้องให้น้องโดยเฉพาะ\n" +
    "รบกวนชำระ มัดจำ{pct} นะคะ\n\n" +
    "✨ มัดจำส่วนนี้นำไปหักจากยอดสุดท้ายทั้งหมด ไม่มีการเก็บเพิ่มค่ะ\n\n" +
    "โอนแล้วส่งสลิปมาได้เลย เดี๋ยวเรายืนยันคิวให้น้องทันที 🐾",
  depositThanksTitle: "ขอบคุณสำหรับการวางมัดจำ 🧡",
  depositThanksBody:
    "รับมัดจำของ{pet}เรียบร้อยแล้วนะคะ 🐾 ทางร้านจะเก็บไว้เป็นค่าจองคิว และหักออกจากยอดในวันที่น้องมาใช้บริการค่ะ ขอบคุณที่ไว้ใจให้เราดูแลน้องนะคะ",
  /** วันเกิดเจ้าของ — พูดกับ "คน" ไม่ใช่กับสัตว์เลี้ยง (ใช้ {name} {shop}) */
  birthdayGreetingOwner:
    "🎂 สุขสันต์วันเกิด{name} นะคะ! 🥳\n" +
    "ขอให้ปีนี้มีแต่ความสุข สุขภาพแข็งแรง และมีเวลาดีๆ กับน้องเยอะๆ นะคะ 🐾💛\n\n" +
    "🎁 ทาง {shop} มีของขวัญวันเกิดให้ด้วยค่ะ",
  birthdayGreeting:
    "🎂 สุขสันต์วันเกิด{pet} นะคะ! 🥳\n" +
    "ขอให้น้องสุขภาพแข็งแรง น่ารักแบบนี้ตลอดไปเลยน้าา 🐾💛\n\n" +
    "🎁 ทาง {shop} มีของขวัญวันเกิดให้ — รับส่วนลดพิเศษเดือนเกิดของน้อง ทักมารับสิทธิ์ได้เลยค่ะ",
  bookingApprovedText:
    "🎉 {shop}\n" +
    "ยืนยันคิวของ{pet}เรียบร้อยแล้วนะคะ\n" +
    "{when}\n\n" +
    "แล้วเจอกันนะคะ 🐾",
  depositTerms: [
    "มัดจำนี้จะนำไปหักเป็นส่วนลดยอดในวันใช้บริการค่ะ",
    "ถ้ามีเหตุต้องเลื่อนหรือยกเลิก รบกวนกระซิบบอกเราล่วงหน้าอย่างน้อย 7 วันนะคะ 💛",
    "หากแจ้งกระชั้นกว่า 7 วัน ขออนุญาตเก็บมัดจำไว้เป็นค่าจองคิวที่กันเวลาให้น้องนะคะ ขอบคุณที่เข้าใจค่ะ 🙏",
  ],
  consentTitle: "ข้อตกลงและเงื่อนไขการเข้าพัก",
  consentTerms: [
    "โรงแรมให้คำมั่นว่าจะดูแลสัตว์เลี้ยงทุกตัวตามมาตรฐานของกฎหมาย เช่น พระราชบัญญัติป้องกันการทารุณกรรมและการจัดสวัสดิภาพสัตว์ พ.ศ. 2557 และจะรักษาสุขอนามัยของสถานที่อย่างเคร่งครัด",
    "โรงแรมจะดูแลสัตว์เลี้ยงอย่างดีที่สุด แต่ไม่รับผิดชอบต่ออาการป่วย อุบัติเหตุ หรือการบาดเจ็บที่เกิดขึ้นจากโรคประจำตัว หรือพฤติกรรมของสัตว์เลี้ยงเอง เช่น การกัด ข่วน หรือเล่นกันรุนแรง",
    "โรงแรมไม่รับผิดชอบในกรณีสัตว์เลี้ยงเจ็บป่วยหรือเสียชีวิตจากเหตุสุดวิสัย เช่น ภัยธรรมชาติ โรคแฝงที่สัตว์เลี้ยงมีมาก่อนเข้าพัก หรือกรณีฉุกเฉินที่อยู่นอกเหนือการควบคุมของโรงแรม",
    "หากพบว่าสัตว์เลี้ยงมีโรคติดต่อ เห็บ หมัด โรงแรมมีสิทธิ์แยกสัตว์เลี้ยงออกจากพื้นที่รวมเพื่อป้องกันการแพร่เชื้อ และหากมีความเสียหายเจ้าของต้องเป็นผู้รับผิดชอบค่าเสียหาย",
    "หากสัตว์เลี้ยงมีอาการเจ็บป่วยระหว่างเข้าพัก โรงแรมจะแจ้งเจ้าของทันทีที่พบอาการผิดปกติ และประสานงานกับโรงพยาบาลสัตว์ โดยเจ้าของตกลงรับผิดชอบค่าใช้จ่ายในการรักษาทั้งหมด (ค่าตรวจ ค่ายา ค่าพักฟื้น ฯลฯ) กรณีติดต่อเจ้าของไม่ได้ โรงแรมจะดำเนินการรักษาฉุกเฉินตามดุลยพินิจของสัตวแพทย์",
    "การฝากน้องที่มีความเสี่ยงเสียชีวิตขณะเข้าพัก เช่น ป่วยระยะสุดท้ายหรือแก่ชรา ทางโรงแรมขอสงวนสิทธิ์ในการรับผิดชอบทุกกรณี",
    "การยกเลิกหรือเปลี่ยนแปลงการเข้าพักต้องแจ้งล่วงหน้า 5-10 วัน และอาจมีค่าปรับตามที่โรงแรมกำหนด",
    "เจ้าของตกลงรับผิดชอบกรณีที่สัตว์เลี้ยงสร้างความเสียหายต่อทรัพย์สินของโรงแรม",
    "โรงแรมไม่รับผิดชอบต่อทรัพย์สินส่วนตัวของเจ้าของที่ฝากไว้กับสัตว์เลี้ยง เช่น ปลอกคอ ของเล่น หรืออุปกรณ์อื่น ๆ",
    "หากตั้งใจไม่มารับสัตว์เลี้ยงตามกำหนดหรือทิ้งสัตว์เลี้ยง ทางโรงแรมจะดำเนินการตาม พ.ร.บ.คุ้มครองสัตว์ และมีสิทธิ์ดำเนินการตามสมควรตามการตัดสินใจของโรงแรม",
    "หากเจ้าของไม่ได้แนบสมุดวัคซีนของน้อง ถือว่าเจ้าของรับทราบและยอมรับข้อตกลงทั้งหมด รวมถึงความเสี่ยงจากการที่โรงแรมไม่ได้ตรวจสอบประวัติวัคซีน",
  ],
  groomConsentTitle: "ข้อตกลงและเงื่อนไขก่อนใช้บริการอาบน้ำสัตว์เลี้ยง",
  // "หัวข้อ — เนื้อหา" หน้ากดยอมรับจะโชว์หัวข้อตัวหนา
  groomConsentTerms: [
    "สุขภาพและโรคประจำตัว — ผู้ปกครองต้องแจ้งโรคประจำตัว ประวัติการแพ้ยา แพ้ผลิตภัณฑ์ โรคผิวหนัง อาการเจ็บป่วย และข้อควรระวังต่าง ๆ ตามความเป็นจริง น้องที่มีอาการป่วยหรือสงสัยโรคติดต่อ ทางร้านขอสงวนสิทธิ์ปฏิเสธหรือเลื่อนการให้บริการ",
    "ความเครียดและพฤติกรรม — การอาบน้ำอาจทำให้น้องเกิดความเครียด ตื่นกลัว หรือมีพฤติกรรมเปลี่ยนแปลงได้ หากน้องมีอาการเครียดรุนแรง ก้าวร้าว หายใจผิดปกติ หรือมีความเสี่ยงต่อสุขภาพ ทางร้านขอสงวนสิทธิ์หยุดให้บริการทันทีเพื่อความปลอดภัย",
    "สภาพผิวหนังและเส้นขน — กรณีขนพันกันเป็นก้อน ขนสังกะตัง หรือมีปัญหาผิวหนัง การแปรงหรือตัดขนอาจทำให้เกิดการระคายเคืองหรือเผยให้เห็นบาดแผลเดิมที่ซ่อนอยู่ ทางร้านจะแจ้งให้ผู้ปกครองทราบหากพบความผิดปกติหรือจำเป็นต้องมีบริการเพิ่มเติม",
    "ความปลอดภัยระหว่างให้บริการ — ทางร้านให้ความสำคัญกับความปลอดภัยของน้องเป็นอันดับแรก และจะดูแลอย่างระมัดระวัง อย่างไรก็ตาม อาจเกิดอาการแพ้ ระคายเคือง ความเครียด หรืออาการผิดปกติจากโรคประจำตัวที่ไม่แสดงอาการมาก่อนได้",
    "กรณีฉุกเฉิน — หากเกิดเหตุฉุกเฉิน ทางร้านจะรีบติดต่อผู้ปกครองโดยเร็วที่สุด หากไม่สามารถติดต่อได้และจำเป็นต้องได้รับการรักษาเร่งด่วน ผู้ปกครองยินยอมให้ทางร้านนำส่งสัตวแพทย์ โดยค่าใช้จ่ายและความรับผิดชอบจะพิจารณาตามสาเหตุและข้อเท็จจริงของเหตุการณ์",
    "การยุติบริการและค่าบริการ — หากไม่สามารถดำเนินการอาบน้ำจนเสร็จได้ เนื่องจากสุขภาพหรือพฤติกรรมของน้อง ทางร้านจะแจ้งผู้ปกครอง พร้อมสรุปขั้นตอนที่ดำเนินการแล้วและค่าบริการตามความเหมาะสม",
    "ขอบเขตความรับผิดชอบ — ผู้ปกครองรับทราบความเสี่ยงตามธรรมชาติของการอาบน้ำและกรูมมิ่งสัตว์เลี้ยง ทั้งนี้ ทางร้านยังคงรับผิดชอบต่อความเสียหายที่เกิดจากความประมาทของทางร้านตามกฎหมาย",
  ],
};

/** ข้อตกลงค่าเริ่มต้นฉบับภาษาอังกฤษ (ลูกค้าที่เลือก EN) — เนื้อหาตรงกับ DEFAULT_MESSAGES */
const DEFAULT_CONSENT_EN = {
  consentTitle: "Boarding terms and conditions",
  consentTerms: [
    "The hotel promises to care for every pet in line with legal standards, such as the Prevention of Animal Cruelty and Provision of Animal Welfare Act B.E. 2557 (2014), and to keep the premises strictly hygienic.",
    "The hotel will take the best possible care of your pet but is not responsible for illness, accidents or injuries caused by pre-existing conditions or the pet's own behaviour, such as biting, scratching or rough play.",
    "The hotel is not responsible if a pet becomes ill or dies due to events beyond its control, such as natural disasters, hidden conditions the pet had before the stay, or emergencies outside the hotel's control.",
    "If a pet is found to have a contagious disease, ticks or fleas, the hotel may separate the pet from shared areas to prevent spread, and the owner is responsible for any resulting damage.",
    "If a pet becomes ill during the stay, the hotel will inform the owner as soon as any abnormal signs are found and coordinate with a veterinary hospital. The owner agrees to pay all treatment costs (examination, medicine, recovery, etc.). If the owner cannot be reached, the hotel will arrange emergency treatment at the vet's discretion.",
    "For pets with a risk of dying during the stay, such as terminally ill or very elderly pets, the hotel reserves the right to accept no responsibility in any case.",
    "Cancellations or changes to a stay must be notified 5–10 days in advance and may be subject to a fee set by the hotel.",
    "The owner agrees to be responsible for any damage the pet causes to the hotel's property.",
    "The hotel is not responsible for the owner's personal items left with the pet, such as collars, toys or other accessories.",
    "If a pet is intentionally not collected on time or is abandoned, the hotel will act under the Animal Welfare Act and may take any action it considers appropriate.",
    "If the owner does not attach the pet's vaccine book, the owner acknowledges and accepts all terms, including the risk of the hotel not having checked the pet's vaccination history.",
  ],
  groomConsentTitle: "Terms and conditions for pet grooming",
  groomConsentTerms: [
    "Health and existing conditions — Owners must truthfully tell us about any existing conditions, medicine or product allergies, skin disease, illness and other precautions. For pets that are unwell or suspected of having a contagious disease, the shop reserves the right to refuse or postpone the service.",
    "Stress and behaviour — Bathing can make pets stressed, frightened or change their behaviour. If a pet shows severe stress, aggression, abnormal breathing or any health risk, the shop reserves the right to stop the service immediately for safety.",
    "Skin and coat condition — With heavily matted or tangled fur or skin problems, brushing or clipping may cause irritation or reveal existing hidden wounds. The shop will let the owner know if anything abnormal is found or extra services are needed.",
    "Safety during the service — Your pet's safety is our first priority and we handle every pet with care. However, allergies, irritation, stress or symptoms of conditions that had not shown before may still occur.",
    "Emergencies — In an emergency the shop will contact the owner as quickly as possible. If the owner cannot be reached and urgent treatment is needed, the owner allows the shop to take the pet to a vet; costs and responsibility will be decided based on the cause and facts of the incident.",
    "Stopping the service and charges — If grooming cannot be completed because of the pet's health or behaviour, the shop will inform the owner, summarise what has been done and charge accordingly.",
    "Scope of responsibility — Owners acknowledge the natural risks of bathing and grooming pets. The shop remains legally responsible for any damage caused by its own negligence.",
  ],
};

const sameList = (a: string[] | undefined, b: string[]) =>
  !a?.length || (a.length === b.length && a.every((x, i) => x.trim() === b[i].trim()));

/** หัวเรื่อง + ข้อตกลงที่ใช้กับนัดนี้ — นัดอาบน้ำใช้ข้อตกลงอาบน้ำ แยกจากกฎเข้าพัก */
export function consentTextFor(
  m: Partial<MessagesConfig> | undefined,
  service?: string,
  locale: "th" | "en" = "th",
): { title: string; terms: string[] } {
  if (locale === "en") {
    // ร้านใส่ภาษาอังกฤษเอง → ใช้ของร้าน · ร้านใช้ข้อตกลงของระบบ → ฉบับอังกฤษของระบบ · ร้านแก้ไทยเองไม่ได้ใส่อังกฤษ → ไทยของร้าน
    const groom = service === "groom";
    const th = consentTextFor(m, service, "th");
    const ownEnTerms = (groom ? m?.groomConsentTermsEn : m?.consentTermsEn)?.filter((t) => t.trim());
    const ownEnTitle = (groom ? m?.groomConsentTitleEn : m?.consentTitleEn)?.trim();
    const isDefaultTerms = sameList(groom ? m?.groomConsentTerms : m?.consentTerms, groom ? DEFAULT_MESSAGES.groomConsentTerms : DEFAULT_MESSAGES.consentTerms);
    const thTitle = groom ? m?.groomConsentTitle : m?.consentTitle;
    const isDefaultTitle = !thTitle?.trim() || thTitle.trim() === (groom ? DEFAULT_MESSAGES.groomConsentTitle : DEFAULT_MESSAGES.consentTitle);
    return {
      title: ownEnTitle || (isDefaultTitle ? (groom ? DEFAULT_CONSENT_EN.groomConsentTitle : DEFAULT_CONSENT_EN.consentTitle) : th.title),
      terms: ownEnTerms?.length
        ? ownEnTerms
        : isDefaultTerms
          ? groom ? DEFAULT_CONSENT_EN.groomConsentTerms : DEFAULT_CONSENT_EN.consentTerms
          : th.terms,
    };
  }
  if (service === "groom") {
    return {
      title: m?.groomConsentTitle || DEFAULT_MESSAGES.groomConsentTitle,
      terms: m?.groomConsentTerms?.length ? m.groomConsentTerms : DEFAULT_MESSAGES.groomConsentTerms,
    };
  }
  return {
    title: m?.consentTitle || DEFAULT_MESSAGES.consentTitle,
    terms: m?.consentTerms?.length ? m.consentTerms : DEFAULT_MESSAGES.consentTerms,
  };
}

/** วันที่บนการ์ดข้อตกลง — นัดอาบน้ำโชว์วัน+เวลานัด · เข้าพักโชว์เข้า → ออก · ห้อง */
export function consentDates(b: {
  service?: string;
  date?: string;
  time?: string;
  checkin?: string;
  checkout?: string;
  room?: string;
}): { checkin?: string; checkout?: string; room?: string; groom?: boolean } {
  if (b.service === "groom") {
    return { checkin: b.date ? `${b.date}${b.time ? ` ${b.time} น.` : ""}` : undefined, groom: true };
  }
  return { checkin: b.checkin || b.date, checkout: b.checkout, room: b.room };
}

/**
 * แทนที่ {placeholder} ในเทมเพลตด้วยค่าจริง แล้วเก็บกวาดช่องว่าง/บรรทัดว่างส่วนเกิน
 * (เผื่อ placeholder บางตัวว่าง เช่น ไม่มีวันออก/ไม่มีห้อง)
 */
export function renderTemplate(
  tpl: string,
  vars: Record<string, string | number | undefined | null>
): string {
  return tpl
    .replace(/\{(\w+)\}/g, (_, k) => {
      // {pet} = ชื่อน้อง (เดิมชื่อ {pet} — ข้อความเก่ายังใช้ได้)
      const v = vars[k] ?? (k === "pet" ? vars.cat : k === "cat" ? vars.pet : undefined);
      return v === undefined || v === null ? "" : String(v);
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

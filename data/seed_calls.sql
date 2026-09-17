USE performance_coaching;

-- 2 more calls for Will Jackson (PR-6104) under user 5
INSERT INTO call_sessions (session_id, user_id, customer_id, customer_name, personality_id, company_name, turn_count) VALUES
('seed-pr-good-001', 5, 'PR-6104', 'Will Jackson', 'cooperative', 'Acme Collections', 4),
('seed-pr-bad-001', 5, 'PR-6104', 'Will Jackson', 'defensive', 'Acme Collections', 3);

-- Good call with Will
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-pr-good-001', 1, 'Hi Will, this is Agent from Acme Collections. This call is an attempt to collect a debt and any information obtained will be used for that purpose. Am I speaking with Will Jackson?', 'Yes, this is Will. I was expecting your call actually.', '[]'),
('seed-pr-good-001', 2, 'Thank you for confirming, Will. I can see your personal loan account PR-6104 is 130 days past due with a total pending of $29,900. Can you help me understand what has been going on?', 'I lost my job three months ago and I have been struggling. I want to pay but I just cannot afford the full amount right now.', '[]'),
('seed-pr-good-001', 3, 'I completely understand, Will. Job loss is incredibly stressful and I appreciate you being upfront with me. Let me see what options we can work out. Would you be able to manage $100 per month while you get back on your feet?', 'Yes, I think I can do $100 a month. That would really help me stay on track without drowning.', '[]'),
('seed-pr-good-001', 4, 'Great. So to confirm, we will set up a payment plan of $100 per month starting next Friday. I will send you a confirmation email with all the details. Is there anything else I can help you with today?', 'No, that is perfect. Thank you so much for being understanding.', '[]');

-- Bad call with Will (no disclosure, aggressive, no empathy)
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-pr-bad-001', 1, 'Yeah hi, is this Will? You owe us almost thirty thousand dollars. When are you going to pay?', 'Excuse me? Who is this? That is very rude.', '[]'),
('seed-pr-bad-001', 2, 'Look, I do not have time for this. You need to pay your bill. It has been over four months. Are you going to pay or not?', 'I told you people before, I lost my job. I cannot pay right now. Stop being aggressive.', '[]'),
('seed-pr-bad-001', 3, 'Fine. Then expect further action on your account. Goodbye.', 'Wait, I wanted to discuss a plan but you are not even listening to me!', '[]');

-- 3 calls for Jacob John (RV-4102) under user 5
INSERT INTO call_sessions (session_id, user_id, customer_id, customer_name, personality_id, company_name, turn_count) VALUES
('seed-rv-good-001', 5, 'RV-4102', 'Jacob John', 'negotiating', 'Acme Collections', 5),
('seed-rv-avg-001', 5, 'RV-4102', 'Jacob John', 'cooperative', 'Acme Collections', 4),
('seed-rv-bad-001', 5, 'RV-4102', 'Jacob John', 'evasive', 'Acme Collections', 3);

-- Good call with Jacob
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-rv-good-001', 1, 'Good morning, this is Agent calling from Acme Collections. This call is regarding a debt and any information will be used for that purpose. May I speak with Jacob John?', 'Yes, that is me. What is this about?', '[]'),
('seed-rv-good-001', 2, 'Thank you Jacob. I am calling regarding your credit card account RV-4102 which currently shows 50 days past due with $14,850 pending. Can you confirm your date of birth for verification?', 'Sure, it is March 15, 1988. I know I am behind, I have been meaning to call you guys.', '[]'),
('seed-rv-good-001', 3, 'Thank you for verifying. I appreciate that, Jacob. Can you tell me what has been making it difficult to keep up with the payments?', 'My wife had a medical emergency and the hospital bills wiped us out. I am back on my feet now though and want to sort this out.', '[]'),
('seed-rv-good-001', 4, 'I am really sorry to hear about that, Jacob. Medical emergencies are overwhelming. The good news is we have several options. Would you prefer a reduced monthly plan or could you manage a lump settlement? I can check if we can waive some of the late fees.', 'A monthly plan would be best. Maybe $200 a month? And if you can waive the late fees that would be amazing.', '[]'),
('seed-rv-good-001', 5, 'I can absolutely set that up. $200 per month with a request to waive the $430 in late fees since you are setting up autopay. Your first payment will be on the 1st of next month. I will email you the confirmation. Thank you for working with me today, Jacob.', 'Thank you so much. I really appreciate your help.', '[]');

-- Average call with Jacob
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-rv-avg-001', 1, 'Hi, this is Acme Collections calling about your account. Is this Jacob John?', 'Yes it is. What account are you talking about?', '[]'),
('seed-rv-avg-001', 2, 'Your credit card account RV-4102. It is 50 days past due. You owe $14,850. We need to discuss payment options.', 'Oh right. Yeah I know. I have been busy. What are my options?', '[]'),
('seed-rv-avg-001', 3, 'You can pay in full or set up a monthly plan. What works for you?', 'Monthly plan I guess. How much per month?', '[]'),
('seed-rv-avg-001', 4, 'We can do $300 a month. Does that work? Let me know and I will set it up.', 'That is a lot but I guess I do not have a choice. Fine, set it up.', '[]');

-- Bad call with Jacob (agent loses control, no verification, poor handling)
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-rv-bad-001', 1, 'Jacob? This is collections. You have not paid in almost two months. What is going on?', 'Who is this? I do not recognize this number.', '[]'),
('seed-rv-bad-001', 2, 'It is Acme Collections. You owe fourteen thousand. We need payment today or there will be consequences.', 'Are you threatening me? I am going to report this call.', '[]'),
('seed-rv-bad-001', 3, 'I am not threatening, I am just stating facts. Call us back when you are ready to pay.', 'You have not even verified who I am. This is ridiculous.', '[]');

-- 3 calls for Bob David (AN-8107) under user 5
INSERT INTO call_sessions (session_id, user_id, customer_id, customer_name, personality_id, company_name, turn_count) VALUES
('seed-an-good-001', 5, 'AN-8107', 'Bob David', 'cooperative', 'Acme Collections', 5),
('seed-an-avg-001', 5, 'AN-8107', 'Bob David', 'negotiating', 'Acme Collections', 4),
('seed-an-bad-001', 5, 'AN-8107', 'Bob David', 'defensive', 'Acme Collections', 3);

-- Good call with Bob
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-an-good-001', 1, 'Good afternoon, my name is Agent and I am calling from Acme Collections. This is an attempt to collect a debt and any information obtained will be used for that purpose. Am I speaking with Bob David?', 'Yes, this is Bob.', '[]'),
('seed-an-good-001', 2, 'Thank you, Bob. For verification, can you confirm the last four digits of your Social Security number?', 'Sure, it is 4523.', '[]'),
('seed-an-good-001', 3, 'Perfect, thank you. I am calling about your auto loan account AN-8107, which is currently 40 days past due with $22,550 outstanding. I would love to help you find a solution. Can you share what has been happening?', 'Honestly, I took on too many expenses this quarter. My car payment just slipped through the cracks. I can definitely catch up.', '[]'),
('seed-an-good-001', 4, 'I appreciate your honesty, Bob. It sounds like this is manageable for you. Would you like to make a catch-up payment now and get back on your regular schedule, or would a revised plan work better?', 'I can make the two missed payments this week actually. Can I do that over the phone?', '[]'),
('seed-an-good-001', 5, 'Absolutely! I can process that right now. So that is two payments of $543.33, totaling $1,086.66. After this, your next regular payment would resume on the 15th. I will send confirmation to your email. Thank you for taking care of this, Bob.', 'Great, let us do it. Thanks for making this easy.', '[]');

-- Average call with Bob
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-an-avg-001', 1, 'Hello, is this Bob David? This is Acme Collections regarding your auto loan.', 'Yeah, what about it?', '[]'),
('seed-an-avg-001', 2, 'Your account AN-8107 is 40 days past due. The amount owing is $22,550. Can we discuss how to bring this current?', 'I know I missed a payment. I will get to it. What do you need from me?', '[]'),
('seed-an-avg-001', 3, 'Can you commit to a payment date? We want to avoid any further action on the account.', 'Fine, I will pay next Friday. Is that good enough?', '[]'),
('seed-an-avg-001', 4, 'That works. I will note that down. If payment is not received by Friday we will need to follow up again. Thank you.', 'Okay, bye.', '[]');

-- Bad call with Bob (no disclosure, confrontational, no resolution)
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-an-bad-001', 1, 'Bob, you have missed your car payment again. This is the third time we are calling.', 'And I told you last time I would handle it. Why do you keep calling?', '[]'),
('seed-an-bad-001', 2, 'Because you keep saying that and nothing happens. We cannot keep waiting. Your account is going to be sent to legal if you do not pay immediately.', 'Are you serious? You cannot threaten me like that. I want to speak to your supervisor.', '[]'),
('seed-an-bad-001', 3, 'I am not threatening, I am informing you of the process. If you want to talk to someone else, call back during business hours.', 'This is business hours! You people are unbelievable.', '[]');

-- New test call for Will Jackson (PR-6104) under user 5 — payment plan + contact update
INSERT INTO call_sessions (session_id, user_id, customer_id, customer_name, personality_id, company_name, turn_count, call_type, dialed_phone) VALUES
('seed-will-newtest-001', 5, 'PR-6104', 'Will Jackson', 'negotiating', 'Acme Collections', 5, 'Outbound', '9912345678');

INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-will-newtest-001', 1, 'Good afternoon, this is Agent from Acme Collections. This call is an attempt to collect a debt and any information obtained will be used for that purpose. Am I speaking with Will Jackson?', 'Yes, this is Will. I figured you would call eventually.', '[]'),
('seed-will-newtest-001', 2, 'Thank you for confirming, Will. Your personal loan account PR-6104 is showing 130 days past due with a total pending of $29,900. Can you help me understand what has been going on?', 'I had some medical bills pile up and I fell behind. I do want to clear this, I just cannot pay the whole thing at once.', '[]'),
('seed-will-newtest-001', 3, 'I completely understand, Will, medical situations are tough. Let us find something workable. Would a monthly payment plan help you get back on track?', 'Yeah, a plan would help. Maybe around $250 a month? Also my number changed, the best one to reach me now is 9912345670.', '[]'),
('seed-will-newtest-001', 4, 'Absolutely, I can set up $250 per month and update your preferred contact number to 9912345670. Just to confirm, would you like the first payment to start next Friday?', 'Yes, next Friday works. And can you email the confirmation to will.jackson@email.com?', '[]'),
('seed-will-newtest-001', 5, 'Of course. So to confirm: $250 per month starting next Friday, contact number updated to 9912345670, and a confirmation email to will.jackson@email.com. Anything else I can help with today?', 'No, that covers it. Thanks for being reasonable about this.', '[]');

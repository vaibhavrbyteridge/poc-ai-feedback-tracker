USE performance_coaching;

-- Priyanka 1: Payment negotiation + monthly payment change (dialed 9912345678)
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-pr-pay-001', 1, 'Good morning Priyanka, this is Agent from Acme Collections. This call is an attempt to collect a debt and any information will be used for that purpose. Am I speaking with Priyanka Reddy?', 'Yes, hi. I have been meaning to call you actually. I want to sort out my account.', '[]'),
('seed-pr-pay-001', 2, 'I appreciate that, Priyanka. Your account PR-6104 currently shows $29,900 pending with 130 days past due. Your current monthly payment is $543. Can you share what has been happening?', 'The thing is, $543 is just too much for me right now. I recently started a new job but the salary is lower than before. Can we reduce the monthly amount to something I can actually manage?', '[]'),
('seed-pr-pay-001', 3, 'I completely understand. What amount would work for your current budget?', 'I can comfortably do $150 per month. Also, can you update my email? I am using priyanka.new@gmail.com now, not the old one.', '[]'),
('seed-pr-pay-001', 4, 'I will set up a plan for $150 per month and update your email to priyanka.new@gmail.com. Your first payment would be due on the 15th. Does that work?', 'Perfect, yes. Thank you for being flexible.', '[]');

-- Priyanka 2: Debtor refuses to pay, asks not to be contacted on this number (dialed 9912345680)
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-pr-disp-001', 1, 'Hello, this is Acme Collections calling for Priyanka Reddy regarding account PR-6104.', 'Who gave you this number? This is my husbands phone. Stop calling here.', '[]'),
('seed-pr-disp-001', 2, 'I apologize for the inconvenience. We have this as a contact number on file. Can I speak with Priyanka?', 'She is not here and she does not want to talk to you people. Do not call this number again. Do not text it either. She said she will deal with it when she is ready.', '[]'),
('seed-pr-disp-001', 3, 'I understand. I will mark this number as do not call and do not text. Thank you for letting me know.', 'Good. And stop sending emails to raj.reddy@email.com too. That is my email not hers.', '[]');

-- Rohan 1: Address update + status change (dialed 9886541230)
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-rv-addr-001', 1, 'Hi Rohan, this is Agent calling from Acme Collections. This is a call regarding a debt and any information obtained will be used for that purpose. Is this Rohan Verma?', 'Yeah, it is me. What do you want?', '[]'),
('seed-rv-addr-001', 2, 'I am calling about your credit card account RV-4102. We show $14,850 pending. I wanted to check if you received our last letter?', 'No, I moved last month. I am at 22 Brigade Road, Flat 3A now. You guys have my old address.', '[]'),
('seed-rv-addr-001', 3, 'Thank you for the update, Rohan. I will change your address to 22 Brigade Road, Flat 3A. Now regarding your account, would you like to discuss payment options?', 'Look, I already made a partial payment last week of $500 through my bank. Check your records. The status should be updated.', '[]'),
('seed-rv-addr-001', 4, 'I will look into that payment. If confirmed, we can update your account status. Is there anything else I can help with today?', 'No, just make sure you update the address and check that payment. Bye.', '[]');

-- Rohan 2: Refuses call on home number, asks not to text (dialed 9886541231)
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-rv-dnc-001', 1, 'Hello, I am calling from Acme Collections for Rohan Verma.', 'This is his home phone. Why are you calling here? He told you to use his mobile.', '[]'),
('seed-rv-dnc-001', 2, 'I apologize. Can I reach him at a different number?', 'Use his cell phone, the one ending in 1230. Do not call this home number anymore. And do not send any text messages to this number either.', '[]'),
('seed-rv-dnc-001', 3, 'Understood, I will update the preferences. No more calls or texts to this number. Thank you.', 'Fine. Goodbye.', '[]');

-- Arjun 1: Payment negotiation with fee waiver request (dialed 9445123890)
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-an-pay-001', 1, 'Good afternoon, this is Agent from Acme Collections. This call is an attempt to collect a debt. Am I speaking with Arjun Nair?', 'Yes, that is me. I know why you are calling.', '[]'),
('seed-an-pay-001', 2, 'Thank you Arjun. Your auto loan account AN-8107 is 40 days past due with $22,550 outstanding. Your current monthly payment is $543. Can we discuss bringing this current?', 'Here is the deal. I can pay but I need the late fees waived. How much in late fees do I have?', '[]'),
('seed-an-pay-001', 3, 'You have $500 in late fees accrued. I can request a waiver if you set up autopay today. Would you like to proceed?', 'Yes, but I want to pay $400 per month instead of $543. And waive those fees. If you can do both, I will set up autopay right now.', '[]'),
('seed-an-pay-001', 4, 'I can set up $400 per month with the late fee waiver since you are committing to autopay. Let me process that.', 'Great. Also my timezone is wrong in your system. I am in PST now, not IST. I relocated to the US last year.', '[]'),
('seed-an-pay-001', 5, 'I will update your timezone to PST. So to confirm, $400 per month via autopay starting the 1st, late fees waived. Correct?', 'Yes, confirmed. Thanks for working with me.', '[]');

-- Arjun 2: Demands all contact to stop (dialed 9445123891 - work phone)
INSERT INTO call_turns (session_id, turn_number, collector_transcript, customer_text, suggestions) VALUES
('seed-an-cease-001', 1, 'Hello, this is Acme Collections calling for Arjun Nair regarding account AN-8107.', 'Stop. I have told you before, do not call my work number. I am in a meeting.', '[]'),
('seed-an-cease-001', 2, 'I sincerely apologize for calling at a bad time. Can I schedule a callback at a better time?', 'No. I do not want any more calls on this number. No texts. No emails to my work email arjun.work@company.com either. In fact, only contact me on my personal cell going forward. I am tired of this.', '[]'),
('seed-an-cease-001', 3, 'I understand completely and I apologize. I will mark this work number and work email as do not contact. We will only reach you on your personal number going forward.', 'Good. And make a note that I prefer being called after 6 PM only.', '[]');

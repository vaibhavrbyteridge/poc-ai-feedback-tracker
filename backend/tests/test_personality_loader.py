from app.services.personality_loader import personality_loader


def test_render_defensive():
    prompt, voice = personality_loader.render("defensive")
    assert "Marcus" in prompt
    assert voice.tts_voice_name == "Charon"


def test_list_personalities():
    ids = personality_loader.list_personalities()
    assert "defensive" in ids
    assert "cooperative" in ids

//---------------------------------------------------------------------------

#include <vcl.h>
#pragma hdrstop
//---------------------------------------------------------------------------
USEFORM("UnitMain.cpp", FormMain);
USEFORM("UnitAYChannelSelect.cpp", FormAyChn);
USEFORM("UnitPiano.cpp", FormPiano);
USEFORM("UnitPSGChannelSelect.cpp", FormPSGChannelSelect);
USEFORM("UnitVT2Instrument.cpp", FormVortexExp);
USEFORM("UnitFrameRate.cpp", FormFrameRate);
//---------------------------------------------------------------------------
WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int)
{
	try
	{
		Application->Initialize();
		Application->Title = "AY Sound FX Editor";
		Application->CreateForm(__classid(TFormMain), &FormMain);
		Application->CreateForm(__classid(TFormAyChn), &FormAyChn);
		Application->CreateForm(__classid(TFormPiano), &FormPiano);
		Application->CreateForm(__classid(TFormPSGChannelSelect), &FormPSGChannelSelect);
		Application->CreateForm(__classid(TFormVortexExp), &FormVortexExp);
		Application->CreateForm(__classid(TFormFrameRate), &FormFrameRate);
		Application->Run();
	}
	catch (Exception &exception)
	{
		Application->ShowException(&exception);
	}
	catch (...)
	{
		try
		{
			throw Exception("");
		}
		catch (Exception &exception)
		{
			Application->ShowException(&exception);
		}
	}
	return 0;
}
//---------------------------------------------------------------------------

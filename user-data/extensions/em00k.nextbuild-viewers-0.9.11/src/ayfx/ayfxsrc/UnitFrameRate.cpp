//---------------------------------------------------------------------------

#include <vcl.h>
#pragma hdrstop

#include "UnitFrameRate.h"
//---------------------------------------------------------------------------
#pragma package(smart_init)
#pragma resource "*.dfm"
TFormFrameRate *FormFrameRate;
//---------------------------------------------------------------------------
__fastcall TFormFrameRate::TFormFrameRate(TComponent* Owner)
	: TForm(Owner)
{
}
//---------------------------------------------------------------------------
void __fastcall TFormFrameRate::EditFrameRateKeyPress(TObject *Sender,
      char &Key)
{
	if(!((Key>='0'&&Key<='9')||Key==VK_DELETE||Key==VK_BACK)) Key=0;
}
//---------------------------------------------------------------------------
void __fastcall TFormFrameRate::EditFrameRateChange(TObject *Sender)
{
	EditFrameRate->Text=IntToStr(StrToIntDef(EditFrameRate->Text,0));
}
//---------------------------------------------------------------------------
void __fastcall TFormFrameRate::FormCreate(TObject *Sender)
{
	Confirm=false;
}
//---------------------------------------------------------------------------
void __fastcall TFormFrameRate::Button1Click(TObject *Sender)
{
	Confirm=true;
	Close();
}
//---------------------------------------------------------------------------
void __fastcall TFormFrameRate::Button2Click(TObject *Sender)
{
	Confirm=false;
	Close();
}
//---------------------------------------------------------------------------

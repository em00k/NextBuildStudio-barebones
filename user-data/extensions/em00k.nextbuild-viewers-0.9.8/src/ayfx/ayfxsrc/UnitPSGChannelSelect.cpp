//---------------------------------------------------------------------------

#include <vcl.h>
#pragma hdrstop

#include "UnitPSGChannelSelect.h"

extern int vgm_chan;
extern bool vgm_noise;
extern bool import_ok;

void __fastcall TFormPSGChannelSelect::UpdateVGMSet(void)
{
	vgm_noise=CheckBoxMixNoise->Checked;

	if(RadioButtonChAuto->Checked) vgm_chan=-1;
	if(RadioButtonChTone0->Checked) vgm_chan=0;
	if(RadioButtonChTone1->Checked) vgm_chan=1;
	if(RadioButtonChTone2->Checked) vgm_chan=2;
	if(RadioButtonChNoise->Checked) vgm_chan=3;

	CheckBoxMixNoise->Enabled=(vgm_chan==3)?false:true;
}



//---------------------------------------------------------------------------
#pragma package(smart_init)
#pragma resource "*.dfm"
TFormPSGChannelSelect *FormPSGChannelSelect;
//---------------------------------------------------------------------------
__fastcall TFormPSGChannelSelect::TFormPSGChannelSelect(TComponent* Owner)
: TForm(Owner)
{
}
//---------------------------------------------------------------------------

void __fastcall TFormPSGChannelSelect::ButtonOKClick(TObject *Sender)
{
	import_ok=true;
	Close();	
}
//---------------------------------------------------------------------------

void __fastcall TFormPSGChannelSelect::ButtonCancelClick(TObject *Sender)
{
	import_ok=false;
	Close();
}
//---------------------------------------------------------------------------

void __fastcall TFormPSGChannelSelect::RadioButtonChAutoClick(TObject *Sender)
{
	UpdateVGMSet();
}
//---------------------------------------------------------------------------
void __fastcall TFormPSGChannelSelect::FormCreate(TObject *Sender)
{
	UpdateVGMSet();
}
//---------------------------------------------------------------------------


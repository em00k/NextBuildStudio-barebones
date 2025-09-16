object FormFrameRate: TFormFrameRate
  Left = 0
  Top = 0
  BorderStyle = bsDialog
  Caption = 'Set frame rate'
  ClientHeight = 54
  ClientWidth = 211
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  OldCreateOrder = False
  Position = poMainFormCenter
  Scaled = False
  OnCreate = FormCreate
  PixelsPerInch = 96
  TextHeight = 13
  object EditFrameRate: TEdit
    Left = 16
    Top = 16
    Width = 49
    Height = 21
    TabOrder = 0
    Text = 'EditFrameRate'
    OnChange = EditFrameRateChange
    OnKeyPress = EditFrameRateKeyPress
  end
  object Button1: TButton
    Left = 90
    Top = 15
    Width = 50
    Height = 22
    Caption = 'OK'
    TabOrder = 1
    OnClick = Button1Click
  end
  object Button2: TButton
    Left = 146
    Top = 14
    Width = 50
    Height = 23
    Caption = 'Cancel'
    TabOrder = 2
    OnClick = Button2Click
  end
end
